import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@socialdrop/prisma';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// ─── ISO 8601 duration → seconds ─────────────────────────────────────────────
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 9999;
  return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0');
}

function isShortVideo(title: string, durationIso: string): boolean {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('#short') || titleLower.includes('#ytshort')) return true;
  return parseDurationSeconds(durationIso) <= 60;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── OAuth2 client ────────────────────────────────────────────────────────

  private createOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      this.config.get<string>('YOUTUBE_CLIENT_ID', ''),
      this.config.get<string>('YOUTUBE_CLIENT_SECRET', ''),
      this.config.get<string>('YOUTUBE_REDIRECT_URI', ''),
    );
  }

  private async getAuthedClient(userId: string): Promise<{ client: OAuth2Client; integrationId: string } | null> {
    const integration = await this.prisma.integration.findFirst({
      where: { userId, platform: 'YOUTUBE' },
    });
    if (!integration) return null;

    const client = this.createOAuth2Client();
    client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken ?? undefined,
      expiry_date: integration.tokenExpiry?.getTime(),
    });

    // Persist refreshed tokens automatically
    client.on('tokens', async (tokens) => {
      this.logger.log(`[YouTube] Token refreshed for integration=${integration.id}`);
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokens.access_token ?? integration.accessToken,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          ...(tokens.expiry_date ? { tokenExpiry: new Date(tokens.expiry_date) } : {}),
        },
      });
    });

    return { client, integrationId: integration.id };
  }

  // ─── Polling ──────────────────────────────────────────────────────────────

  async pollComments(userId: string): Promise<{ polled: number; newComments: number; autoReplied: number }> {
    const ctx = await this.getAuthedClient(userId);
    if (!ctx) {
      this.logger.log(`[YouTube] No YOUTUBE integration for user ${userId}`);
      return { polled: 0, newComments: 0, autoReplied: 0 };
    }
    const { client } = ctx;
    const youtube = google.youtube({ version: 'v3', auth: client });

    // 1. Get uploads playlist ID (1 quota unit)
    const channelRes = await youtube.channels.list({
      part: ['contentDetails'],
      mine: true,
    });
    const uploadsPlaylistId =
      channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      this.logger.warn(`[YouTube] No uploads playlist for user ${userId}`);
      return { polled: 0, newComments: 0, autoReplied: 0 };
    }

    // 2. Get recent videos (1 quota unit)
    const playlistRes = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 20,
    });
    const videoIds = (playlistRes.data.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => !!id);

    if (videoIds.length === 0) return { polled: 0, newComments: 0, autoReplied: 0 };

    // 3. Get video details to detect Shorts (1 quota unit per page)
    const videosRes = await youtube.videos.list({
      part: ['snippet', 'contentDetails'],
      id: videoIds,
      maxResults: 20,
    });
    const videos = videosRes.data.items ?? [];

    const autoReplies = await this.prisma.youtubeAutoReply.findMany({
      where: { userId, isEnabled: true },
    });

    let polled = 0;
    let newComments = 0;
    let autoReplied = 0;

    for (const video of videos) {
      const videoId = video.id ?? '';
      const title = video.snippet?.title ?? '';
      const duration = video.contentDetails?.duration ?? 'PT0S';
      const isShort = isShortVideo(title, duration);

      polled++;

      // 4. Fetch top-level comment threads for this video (2 quota units)
      let pageToken: string | undefined;
      do {
        let threadsRes;
        try {
          threadsRes = await youtube.commentThreads.list({
            part: ['snippet'],
            videoId,
            maxResults: 50,
            order: 'time',
            ...(pageToken ? { pageToken } : {}),
          });
        } catch (err: any) {
          // Comments disabled on this video — skip
          if (err?.code === 403 || err?.message?.includes('disabled')) break;
          throw err;
        }

        const threads = threadsRes.data.items ?? [];
        for (const thread of threads) {
          const top = thread.snippet?.topLevelComment?.snippet;
          if (!top) continue;
          const commentId = thread.snippet?.topLevelComment?.id ?? '';

          // Check if already stored
          const existing = await this.prisma.youtubeComment.findUnique({
            where: { commentId },
          });
          if (existing) continue;

          // Store new comment
          const saved = await this.prisma.youtubeComment.create({
            data: {
              userId,
              videoId,
              videoTitle: title,
              commentId,
              authorName: top.authorDisplayName ?? 'Unknown',
              authorChannelId: top.authorChannelId ?? null,
              text: top.textDisplay ?? top.textOriginal ?? '',
              likeCount: top.likeCount ?? 0,
              replyCount: thread.snippet?.totalReplyCount ?? 0,
              publishedAt: top.publishedAt ? new Date(top.publishedAt) : null,
              isShort,
            },
          });
          newComments++;

          // 5. Apply auto-reply rules
          const matchedRule = autoReplies.find((rule) =>
            saved.text.toLowerCase().includes(rule.keyword.toLowerCase()),
          );
          if (matchedRule) {
            try {
              await youtube.comments.insert({
                part: ['snippet'],
                requestBody: {
                  snippet: {
                    parentId: commentId,
                    textOriginal: matchedRule.replyTemplate,
                  },
                },
              });
              await this.prisma.youtubeComment.update({
                where: { id: saved.id },
                data: {
                  replied: true,
                  repliedAt: new Date(),
                  replyText: matchedRule.replyTemplate,
                },
              });
              autoReplied++;
              this.logger.log(
                `[YouTube] Auto-replied to comment ${commentId} on video ${videoId} ` +
                `(keyword="${matchedRule.keyword}")`,
              );
            } catch (replyErr) {
              this.logger.error(
                `[YouTube] Auto-reply failed for comment ${commentId}: ${(replyErr as Error).message}`,
              );
            }
          }
        }

        pageToken = threadsRes.data.nextPageToken ?? undefined;
        // Only fetch first page per video to stay within quota budget
        break;
      } while (pageToken);
    }

    this.logger.log(
      `[YouTube] Poll complete for ${userId}: polled=${polled} newComments=${newComments} autoReplied=${autoReplied}`,
    );
    return { polled, newComments, autoReplied };
  }

  // ─── Manual reply ─────────────────────────────────────────────────────────

  async replyToComment(userId: string, commentId: string, text: string): Promise<void> {
    const comment = await this.prisma.youtubeComment.findUnique({ where: { commentId } });
    if (!comment) throw new Error(`Comment ${commentId} not found`);

    const ctx = await this.getAuthedClient(userId);
    if (!ctx) throw new Error(`No YouTube integration for user ${userId}`);
    const { client } = ctx;
    const youtube = google.youtube({ version: 'v3', auth: client });

    await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: commentId,
          textOriginal: text,
        },
      },
    });

    await this.prisma.youtubeComment.update({
      where: { commentId },
      data: { replied: true, repliedAt: new Date(), replyText: text },
    });
    this.logger.log(`[YouTube] Manual reply posted to comment ${commentId}`);
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async getComments(userId: string, videoId?: string, onlyUnreplied = false, onlyShorts = false, limit = 50) {
    return this.prisma.youtubeComment.findMany({
      where: {
        userId,
        ...(videoId ? { videoId } : {}),
        ...(onlyUnreplied ? { replied: false } : {}),
        ...(onlyShorts ? { isShort: true } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  // ─── Auto-reply rules CRUD ────────────────────────────────────────────────

  async getAutoReplies(userId: string) {
    return this.prisma.youtubeAutoReply.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAutoReply(userId: string, keyword: string, replyTemplate: string) {
    return this.prisma.youtubeAutoReply.create({
      data: { userId, keyword, replyTemplate },
    });
  }

  async toggleAutoReply(id: string, userId: string) {
    const rule = await this.prisma.youtubeAutoReply.findFirst({ where: { id, userId } });
    if (!rule) throw new Error(`AutoReply rule ${id} not found`);
    return this.prisma.youtubeAutoReply.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });
  }

  async deleteAutoReply(id: string, userId: string) {
    return this.prisma.youtubeAutoReply.deleteMany({ where: { id, userId } });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(userId: string) {
    const [total, unreplied, shorts, autoReplied] = await Promise.all([
      this.prisma.youtubeComment.count({ where: { userId } }),
      this.prisma.youtubeComment.count({ where: { userId, replied: false } }),
      this.prisma.youtubeComment.count({ where: { userId, isShort: true } }),
      this.prisma.youtubeComment.count({ where: { userId, replied: true } }),
    ]);
    return { total, unreplied, shorts, autoReplied };
  }

  // ─── Scheduled polling every 15 minutes ──────────────────────────────────

  @Cron('*/15 * * * *')
  async scheduledPoll(): Promise<void> {
    this.logger.log('[YouTube] Scheduled comment poll triggered');
    try {
      await this.pollComments('demo-user');
    } catch (err) {
      this.logger.error(`[YouTube] Scheduled poll failed: ${(err as Error).message}`);
    }
  }
}
