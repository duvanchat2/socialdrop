import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';
import { Platform } from '@socialdrop/shared';
import { google } from 'googleapis';

interface IgAccountFields {
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  id: string;
}

interface IgMedia {
  id: string;
  caption?: string;
  media_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  media_type?: string;
  error?: { message: string };
}

interface FbPage {
  id: string;
  fan_count?: number;
  followers_count?: number;
}

interface FbPost {
  id: string;
  message?: string;
  full_picture?: string;
  created_time?: string;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

interface YtChannelStats {
  subscriberCount?: string;
  viewCount?: string;
  videoCount?: string;
  hiddenSubscriberCount?: boolean;
}

interface YtVideo {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: { default?: { url?: string } } };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Instagram ─────────────────────────────────────────────────────────────
  async syncInstagram(userId: string): Promise<void> {
    const integration = await this.prisma.integration.findFirst({
      where: { userId, platform: 'INSTAGRAM' },
    });
    if (!integration) {
      this.logger.log(`[Metrics] No INSTAGRAM integration for user ${userId}`);
      return;
    }

    const token = integration.accessToken;
    const igId = integration.profileId;
    if (!igId) {
      this.logger.warn(`[Metrics] INSTAGRAM integration ${integration.id} has no profileId`);
      return;
    }

    try {
      // Account-level stats
      const accountRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}?fields=followers_count,follows_count,media_count&access_token=${token}`,
      );
      if (accountRes.ok) {
        const account = (await accountRes.json()) as IgAccountFields;
        await this.prisma.platformMetrics.create({
          data: {
            userId,
            platform: 'INSTAGRAM',
            followersCount: account.followers_count ?? 0,
            followingCount: account.follows_count ?? null,
            postsCount: account.media_count ?? null,
          },
        });
      }

      // Media posts — only use fields valid for /{ig-user-id}/media
      // reach/impressions/saved/shares are NOT valid media fields; they require separate /insights calls
      const mediaRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}/media?fields=id,caption,media_url,timestamp,like_count,comments_count,media_type&limit=25&access_token=${token}`,
      );
      if (!mediaRes.ok) {
        const errBody = await mediaRes.text();
        this.logger.warn(`[Metrics] Instagram media fetch failed (${mediaRes.status}): ${errBody}`);
      } else {
        const mediaData = (await mediaRes.json()) as { data?: IgMedia[]; error?: { message: string } };
        if (mediaData.error) {
          this.logger.warn(`[Metrics] Instagram media API error: ${mediaData.error.message}`);
        } else {
          const posts = mediaData.data ?? [];
          for (const p of posts) {
            await this.prisma.postAnalytics.upsert({
              where: { userId_platform_platformPostId: { userId, platform: 'INSTAGRAM', platformPostId: p.id } },
              update: {
                likes: p.like_count ?? 0,
                comments: p.comments_count ?? 0,
                recordedAt: new Date(),
              },
              create: {
                userId,
                platform: 'INSTAGRAM',
                platformPostId: p.id,
                caption: p.caption ?? null,
                mediaUrl: p.media_url ?? null,
                likes: p.like_count ?? 0,
                comments: p.comments_count ?? 0,
                publishedAt: p.timestamp ? new Date(p.timestamp) : null,
              },
            });
          }
          this.logger.log(`[Metrics] Instagram: synced ${posts.length} posts for user ${userId}`);
        }
      }
    } catch (err) {
      this.logger.error(`[Metrics] Instagram sync failed for ${userId}: ${(err as Error).message}`);
    }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────
  async syncFacebook(userId: string): Promise<void> {
    const integration = await this.prisma.integration.findFirst({
      where: { userId, platform: 'FACEBOOK' },
    });
    if (!integration) {
      this.logger.log(`[Metrics] No FACEBOOK integration for user ${userId}`);
      return;
    }

    const token = integration.accessToken;
    const pageId = integration.profileId;
    if (!pageId) {
      this.logger.warn(`[Metrics] FACEBOOK integration ${integration.id} has no profileId`);
      return;
    }

    try {
      // Page-level stats
      const pageRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=fan_count,followers_count&access_token=${token}`,
      );
      if (pageRes.ok) {
        const page = (await pageRes.json()) as FbPage;
        await this.prisma.platformMetrics.create({
          data: {
            userId,
            platform: 'FACEBOOK',
            followersCount: page.fan_count ?? page.followers_count ?? 0,
          },
        });
      }

      // Posts
      const postsRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares&limit=25&access_token=${token}`,
      );
      if (postsRes.ok) {
        const postsData = (await postsRes.json()) as { data?: FbPost[] };
        const posts = postsData.data ?? [];
        for (const p of posts) {
          await this.prisma.postAnalytics.upsert({
            where: { userId_platform_platformPostId: { userId, platform: 'FACEBOOK', platformPostId: p.id } },
            update: {
              likes: p.likes?.summary?.total_count ?? 0,
              comments: p.comments?.summary?.total_count ?? 0,
              shares: p.shares?.count ?? 0,
              recordedAt: new Date(),
            },
            create: {
              userId,
              platform: 'FACEBOOK',
              platformPostId: p.id,
              caption: p.message ?? null,
              mediaUrl: p.full_picture ?? null,
              likes: p.likes?.summary?.total_count ?? 0,
              comments: p.comments?.summary?.total_count ?? 0,
              shares: p.shares?.count ?? 0,
              publishedAt: p.created_time ? new Date(p.created_time) : null,
            },
          });
        }
        this.logger.log(`[Metrics] Facebook: synced ${posts.length} posts for user ${userId}`);
      }
    } catch (err) {
      this.logger.error(`[Metrics] Facebook sync failed for ${userId}: ${(err as Error).message}`);
    }
  }

  // ── YouTube helpers ───────────────────────────────────────────────────────

  /** Build an OAuth2Client from stored integration credentials and auto-persist refreshed tokens. */
  private async getYoutubeClient(userId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { userId, platform: 'YOUTUBE' },
    });
    if (!integration) return null;

    const oauth2Client = new google.auth.OAuth2(
      this.config.get<string>('YOUTUBE_CLIENT_ID', ''),
      this.config.get<string>('YOUTUBE_CLIENT_SECRET', ''),
      this.config.get<string>('YOUTUBE_REDIRECT_URI', ''),
    );

    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken ?? undefined,
      expiry_date: integration.tokenExpiry?.getTime(),
    });

    // Save refreshed tokens back to DB automatically
    oauth2Client.on('tokens', async (tokens) => {
      this.logger.log(`[Metrics] YouTube token refreshed for integration=${integration.id}`);
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokens.access_token ?? integration.accessToken,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          ...(tokens.expiry_date ? { tokenExpiry: new Date(tokens.expiry_date) } : {}),
        },
      });
    });

    return { oauth2Client, integration };
  }

  // ── YouTube ───────────────────────────────────────────────────────────────
  async syncYouTube(userId: string): Promise<void> {
    const ctx = await this.getYoutubeClient(userId);
    if (!ctx) {
      this.logger.log(`[Metrics] No YOUTUBE integration for user ${userId}`);
      return;
    }
    const { oauth2Client, integration } = ctx;

    try {
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // ── Channel stats ──────────────────────────────────────────────────
      const channelRes = await youtube.channels.list({
        part: ['statistics'],
        mine: true,
      });

      const stats = channelRes.data.items?.[0]?.statistics as YtChannelStats | undefined;
      if (stats) {
        if (stats.hiddenSubscriberCount) {
          this.logger.warn(`[Metrics] YouTube subscriberCount is hidden for integration=${integration.id} — storing 0`);
        }
        await this.prisma.platformMetrics.create({
          data: {
            userId,
            platform: 'YOUTUBE',
            // When subscribers are hidden the API returns hiddenSubscriberCount=true and no subscriberCount
            followersCount: stats.hiddenSubscriberCount ? 0 : parseInt(stats.subscriberCount ?? '0', 10),
            postsCount: parseInt(stats.videoCount ?? '0', 10),
            reachTotal: parseInt(stats.viewCount ?? '0', 10),
          },
        });
        this.logger.log(
          `[Metrics] YouTube channel: subscribers=${stats.hiddenSubscriberCount ? 'hidden' : stats.subscriberCount} ` +
          `videos=${stats.videoCount} views=${stats.viewCount}`,
        );
      } else {
        this.logger.warn(`[Metrics] YouTube channels.list returned no items for user ${userId}`);
      }

      // ── Uploads playlist → recent videos ──────────────────────────────
      // Use uploads playlist (cheaper than search.list — costs 1 quota unit vs 100)
      const channelDetailRes = await youtube.channels.list({
        part: ['contentDetails'],
        mine: true,
      });
      const uploadsPlaylistId =
        channelDetailRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        this.logger.warn(`[Metrics] YouTube: no uploads playlist found for user ${userId}`);
        return;
      }

      const playlistRes = await youtube.playlistItems.list({
        part: ['contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: 25,
      });

      const videoIds = (playlistRes.data.items ?? [])
        .map((i) => i.contentDetails?.videoId)
        .filter((id): id is string => !!id);

      if (videoIds.length === 0) {
        this.logger.log(`[Metrics] YouTube: no videos found for user ${userId}`);
        return;
      }

      // ── Video stats ────────────────────────────────────────────────────
      const videosRes = await youtube.videos.list({
        part: ['statistics', 'snippet', 'contentDetails'],
        id: videoIds,
        maxResults: 25,
      });

      const videos = videosRes.data.items ?? [];
      for (const v of videos) {
        const vStats = v.statistics as YtVideo['statistics'];
        const videoId = v.id ?? '';
        await this.prisma.postAnalytics.upsert({
          where: { userId_platform_platformPostId: { userId, platform: 'YOUTUBE', platformPostId: videoId } },
          update: {
            views: parseInt(vStats?.viewCount ?? '0', 10),
            likes: parseInt(vStats?.likeCount ?? '0', 10),
            comments: parseInt(vStats?.commentCount ?? '0', 10),
            recordedAt: new Date(),
          },
          create: {
            userId,
            platform: 'YOUTUBE',
            platformPostId: videoId,
            caption: v.snippet?.title ?? null,
            mediaUrl: v.snippet?.thumbnails?.default?.url ?? null,
            views: parseInt(vStats?.viewCount ?? '0', 10),
            likes: parseInt(vStats?.likeCount ?? '0', 10),
            comments: parseInt(vStats?.commentCount ?? '0', 10),
            publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
          },
        });
      }
      this.logger.log(`[Metrics] YouTube: synced ${videos.length} videos for user ${userId}`);
    } catch (err) {
      this.logger.error(`[Metrics] YouTube sync failed for ${userId}: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  // ── Sync all platforms ────────────────────────────────────────────────────
  async syncAll(userId: string): Promise<{ instagram: string; facebook: string; youtube: string }> {
    const results = { instagram: 'skipped', facebook: 'skipped', youtube: 'skipped' };

    await Promise.allSettled([
      this.syncInstagram(userId).then(() => { results.instagram = 'ok'; }).catch((e) => { results.instagram = `error: ${(e as Error).message}`; }),
      this.syncFacebook(userId).then(() => { results.facebook = 'ok'; }).catch((e) => { results.facebook = `error: ${(e as Error).message}`; }),
      this.syncYouTube(userId).then(() => { results.youtube = 'ok'; }).catch((e) => { results.youtube = `error: ${(e as Error).message}`; }),
    ]);

    this.logger.log(`[Metrics] syncAll for ${userId}: ${JSON.stringify(results)}`);
    return results;
  }

  // ── Scheduled sync every 6 hours ─────────────────────────────────────────
  @Cron('0 */6 * * *')
  async scheduledSync(): Promise<void> {
    this.logger.log('[Metrics] Scheduled sync triggered');
    await this.syncAll('demo-user');
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  private periodToSince(period?: string): Date | undefined {
    if (!period) return undefined;
    const days = period === '7d' ? 7 : period === '14d' ? 14 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    return since;
  }

  async getLatestFollowers(userId: string, platform?: string, period?: string) {
    const platforms = platform ? [platform] : ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'TWITTER'];
    const since = this.periodToSince(period);
    const results = await Promise.all(
      platforms.map((p) =>
        this.prisma.platformMetrics.findFirst({
          where: {
            userId,
            platform: p,
            ...(since ? { recordedAt: { gte: since } } : {}),
          },
          orderBy: { recordedAt: 'desc' },
        }),
      ),
    );
    return results.filter(Boolean);
  }

  private postDateFilter(since: Date | undefined) {
    if (!since) return {};
    // Some posts have null publishedAt (API didn't return timestamp).
    // Fall back to recordedAt for those so they still appear in period filters.
    return {
      OR: [
        { publishedAt: { gte: since } },
        { publishedAt: null, recordedAt: { gte: since } },
      ],
    };
  }

  async getPostAnalytics(userId: string, platform?: string, limit = 25, period?: string, sortBy?: string) {
    const since = this.periodToSince(period);
    const orderByField = sortBy === 'views' ? 'views'
      : sortBy === 'likes' ? 'likes'
      : sortBy === 'comments' ? 'comments'
      : sortBy === 'shares' ? 'shares'
      : sortBy === 'engagement' ? 'engagementRate'
      : 'recordedAt';
    return this.prisma.postAnalytics.findMany({
      where: {
        userId,
        ...(platform ? { platform } : {}),
        ...this.postDateFilter(since),
      },
      orderBy: { [orderByField]: 'desc' },
      take: limit,
    });
  }

  // ── Sync status diagnostic ────────────────────────────────────────────────
  async getSyncStatus(userId: string) {
    const platforms = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'TWITTER'];
    const results = await Promise.all(
      platforms.map(async (platform) => {
        const integration = await this.prisma.integration.findFirst({
          where: { userId, platform: platform as Platform },
          select: { id: true, accountName: true, profileId: true, tokenExpiry: true, createdAt: true },
        });
        const lastMetric = await this.prisma.platformMetrics.findFirst({
          where: { userId, platform: platform as Platform },
          orderBy: { recordedAt: 'desc' },
          select: { recordedAt: true, followersCount: true },
        });
        const postCount = await this.prisma.postAnalytics.count({
          where: { userId, platform: platform as Platform },
        });
        return {
          platform,
          connected: !!integration,
          hasProfileId: !!integration?.profileId,
          accountName: integration?.accountName ?? null,
          tokenExpiry: integration?.tokenExpiry ?? null,
          tokenExpired: integration?.tokenExpiry
            ? integration.tokenExpiry.getTime() < Date.now()
            : false,
          lastSync: lastMetric?.recordedAt ?? null,
          followers: lastMetric?.followersCount ?? 0,
          postCount,
        };
      }),
    );
    return results;
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  async getGoals(userId: string) {
    return this.prisma.growthGoal.findMany({ where: { userId }, orderBy: { deadline: 'asc' } });
  }

  async createGoal(userId: string, platform: string, metric: string, target: number, deadline: Date) {
    return this.prisma.growthGoal.create({ data: { userId, platform, metric, target, deadline } });
  }

  async deleteGoal(id: string) {
    return this.prisma.growthGoal.delete({ where: { id } });
  }

  async getOverview(userId: string, period: string, platform?: string) {
    const days = period === '7d' ? 7 : period === '14d' ? 14 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    this.logger.log(`[Metrics] getOverview userId=${userId} period=${period} days=${days} since=${since.toISOString()}`);

    const platformFilter = platform ? { platform } : {};
    const platforms = platform
      ? [platform]
      : ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'TWITTER'];

    // Run all queries in parallel
    const [postRows, currentMetrics, startMetrics] = await Promise.all([
      // Posts within the period — publishedAt preferred, falls back to recordedAt for null
      this.prisma.postAnalytics.findMany({
        where: { userId, ...platformFilter, ...this.postDateFilter(since) },
      }),
      // Current (latest-ever) follower count per platform — not date-filtered
      Promise.all(
        platforms.map((p) =>
          this.prisma.platformMetrics.findFirst({
            where: { userId, platform: p },
            orderBy: { recordedAt: 'desc' },
          }),
        ),
      ),
      // Oldest record per platform within the period — used as the start baseline
      Promise.all(
        platforms.map((p) =>
          this.prisma.platformMetrics.findFirst({
            where: { userId, platform: p, recordedAt: { gte: since } },
            orderBy: { recordedAt: 'asc' }, // oldest in period = baseline
          }),
        ),
      ),
    ]);

    // Build per-platform maps
    const currentMap = new Map<string, number>();
    const startMap   = new Map<string, number>();
    for (let i = 0; i < platforms.length; i++) {
      const cur  = currentMetrics[i];
      const start = startMetrics[i];
      if (cur)   currentMap.set(platforms[i], cur.followersCount);
      if (start) startMap.set(platforms[i], start.followersCount);
    }

    // Follower totals
    const totalFollowers = [...currentMap.values()].reduce((s, v) => s + v, 0);
    const startFollowers = [...startMap.values()].reduce((s, v) => s + v, 0);
    const newFollowers   = totalFollowers - startFollowers;
    const growthPct      = startFollowers > 0
      ? +((newFollowers / startFollowers) * 100).toFixed(2)
      : 0;

    // Post aggregates
    const totalPosts      = postRows.length;
    const totalLikes      = postRows.reduce((s, p) => s + p.likes, 0);
    const totalComments   = postRows.reduce((s, p) => s + p.comments, 0);
    const totalReach      = postRows.reduce((s, p) => s + p.reach, 0);
    const totalImpressions= postRows.reduce((s, p) => s + p.impressions, 0);
    const avgEngagement   = totalPosts > 0
      ? postRows.reduce((s, p) => s + (p.engagementRate ?? 0), 0) / totalPosts
      : 0;

    this.logger.log(
      `[Metrics] overview result: totalFollowers=${totalFollowers} newFollowers=${newFollowers} growthPct=${growthPct}% totalPosts=${totalPosts}`,
    );

    return {
      period,
      totalFollowers,
      newFollowers,
      growthPct,
      totalPosts,
      totalLikes,
      totalComments,
      totalReach,
      totalImpressions,
      avgEngagementRate: avgEngagement,
      byPlatform: Object.fromEntries(
        platforms
          .filter((p) => currentMap.has(p))
          .map((p) => [p, { platform: p, followersCount: currentMap.get(p)! }]),
      ),
    };
  }
}
