import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@socialdrop/prisma';

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
  shares_count?: number;
  saved?: number;
  reach?: number;
  impressions?: number;
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

  constructor(private readonly prisma: PrismaService) {}

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

      // Media posts
      const mediaRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}/media?fields=id,caption,media_url,timestamp,like_count,comments_count,shares_count,saved,reach,impressions&limit=25&access_token=${token}`,
      );
      if (mediaRes.ok) {
        const mediaData = (await mediaRes.json()) as { data?: IgMedia[] };
        const posts = mediaData.data ?? [];
        for (const p of posts) {
          await this.prisma.postAnalytics.upsert({
            where: { userId_platform_platformPostId: { userId, platform: 'INSTAGRAM', platformPostId: p.id } },
            update: {
              likes: p.like_count ?? 0,
              comments: p.comments_count ?? 0,
              shares: p.shares_count ?? 0,
              saves: p.saved ?? 0,
              reach: p.reach ?? 0,
              impressions: p.impressions ?? 0,
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
              shares: p.shares_count ?? 0,
              saves: p.saved ?? 0,
              reach: p.reach ?? 0,
              impressions: p.impressions ?? 0,
              publishedAt: p.timestamp ? new Date(p.timestamp) : null,
            },
          });
        }
        this.logger.log(`[Metrics] Instagram: synced ${posts.length} posts for user ${userId}`);
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

  // ── YouTube ───────────────────────────────────────────────────────────────
  async syncYouTube(userId: string): Promise<void> {
    const integration = await this.prisma.integration.findFirst({
      where: { userId, platform: 'YOUTUBE' },
    });
    if (!integration) {
      this.logger.log(`[Metrics] No YOUTUBE integration for user ${userId}`);
      return;
    }

    const token = integration.accessToken;

    try {
      // Channel stats
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true',
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (channelRes.ok) {
        const channelData = (await channelRes.json()) as { items?: Array<{ statistics: YtChannelStats }> };
        const stats = channelData.items?.[0]?.statistics;
        if (stats && !stats.hiddenSubscriberCount) {
          await this.prisma.platformMetrics.create({
            data: {
              userId,
              platform: 'YOUTUBE',
              followersCount: parseInt(stats.subscriberCount ?? '0', 10),
              postsCount: parseInt(stats.videoCount ?? '0', 10),
              reachTotal: parseInt(stats.viewCount ?? '0', 10),
            },
          });
        }
      }

      // Videos list + stats
      const searchRes = await fetch(
        'https://www.googleapis.com/youtube/v3/search?part=id&forMine=true&type=video&maxResults=25&order=date',
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { items?: Array<{ id: { videoId: string } }> };
        const videoIds = (searchData.items ?? []).map((i) => i.id.videoId).filter(Boolean);
        if (videoIds.length > 0) {
          const videosRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&maxResults=25`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (videosRes.ok) {
            const videosData = (await videosRes.json()) as { items?: YtVideo[] };
            const videos = videosData.items ?? [];
            for (const v of videos) {
              await this.prisma.postAnalytics.upsert({
                where: { userId_platform_platformPostId: { userId, platform: 'YOUTUBE', platformPostId: v.id } },
                update: {
                  views: parseInt(v.statistics?.viewCount ?? '0', 10),
                  likes: parseInt(v.statistics?.likeCount ?? '0', 10),
                  comments: parseInt(v.statistics?.commentCount ?? '0', 10),
                  recordedAt: new Date(),
                },
                create: {
                  userId,
                  platform: 'YOUTUBE',
                  platformPostId: v.id,
                  caption: v.snippet?.title ?? null,
                  mediaUrl: v.snippet?.thumbnails?.default?.url ?? null,
                  views: parseInt(v.statistics?.viewCount ?? '0', 10),
                  likes: parseInt(v.statistics?.likeCount ?? '0', 10),
                  comments: parseInt(v.statistics?.commentCount ?? '0', 10),
                  publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
                },
              });
            }
            this.logger.log(`[Metrics] YouTube: synced ${videos.length} videos for user ${userId}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`[Metrics] YouTube sync failed for ${userId}: ${(err as Error).message}`);
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
        ...(since ? { publishedAt: { gte: since } } : {}),
      },
      orderBy: { [orderByField]: 'desc' },
      take: limit,
    });
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

    const [metricsRows, postRows] = await Promise.all([
      this.prisma.platformMetrics.findMany({
        where: { userId, ...platformFilter, recordedAt: { gte: since } },
        orderBy: { recordedAt: 'desc' },
      }),
      // Filter by publishedAt (when the post was actually published),
      // NOT recordedAt (when we synced it — always recent, breaks period filtering)
      this.prisma.postAnalytics.findMany({
        where: {
          userId,
          ...platformFilter,
          publishedAt: { gte: since },
        },
      }),
    ]);

    const latestByPlatform = new Map<string, typeof metricsRows[0]>();
    for (const m of metricsRows) {
      if (!latestByPlatform.has(m.platform)) latestByPlatform.set(m.platform, m);
    }

    const totalFollowers = [...latestByPlatform.values()].reduce((s, m) => s + m.followersCount, 0);
    const totalPosts = postRows.length;
    const totalLikes = postRows.reduce((s, p) => s + p.likes, 0);
    const totalComments = postRows.reduce((s, p) => s + p.comments, 0);
    const totalReach = postRows.reduce((s, p) => s + p.reach, 0);
    const totalImpressions = postRows.reduce((s, p) => s + p.impressions, 0);
    const avgEngagement = totalPosts > 0
      ? postRows.reduce((s, p) => s + (p.engagementRate ?? 0), 0) / totalPosts
      : 0;

    return {
      period,
      totalFollowers,
      totalPosts,
      totalLikes,
      totalComments,
      totalReach,
      totalImpressions,
      avgEngagementRate: avgEngagement,
      byPlatform: Object.fromEntries(latestByPlatform),
    };
  }
}
