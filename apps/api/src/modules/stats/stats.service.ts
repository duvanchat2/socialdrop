import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';
import Redis from 'ioredis';

const DASHBOARD_CACHE_TTL_SECONDS = 300;

@Injectable()
export class StatsService {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new Redis({
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      lazyConnect: true,
    });
  }

  async getOverview(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [published, pending, failed, total, today] = await Promise.all([
      this.prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
      this.prisma.post.count({
        where: { userId, status: { in: ['PENDING', 'SCHEDULED'] } },
      }),
      this.prisma.post.count({ where: { userId, status: 'ERROR' } }),
      this.prisma.post.count({ where: { userId } }),
      this.prisma.post.count({
        where: {
          userId,
          status: 'PUBLISHED',
          publishedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    return { published, pending, failed, total, today };
  }

  async getByPlatform(userId: string) {
    const byPlatform = await this.prisma.integration.findMany({
      where: { userId },
      include: {
        posts: {
          select: { status: true },
        },
      },
    });

    return byPlatform.map((int) => ({
      platform: int.platform,
      accountName: int.accountName,
      published: int.posts.filter((p) => p.status === 'PUBLISHED').length,
      pending: int.posts.filter((p) => p.status === 'PENDING').length,
      failed: int.posts.filter((p) => p.status === 'ERROR').length,
    }));
  }

  async getDashboard(userId: string, period = '7d') {
    const cacheKey = `stats:dashboard:${userId}:${period}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Non-fatal: if Redis is down, fall through to a fresh computation
    }

    const days = period === '14d' ? 14 : period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);
    const prevPeriodStart = new Date(now);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - days * 2);

    // ERROR posts never get publishedAt set (see post-scheduler.processor.ts), so publishSuccessRate
    // and postsThisWeek/postsLastWeek fall back to updatedAt for them to still land in the right window.
    const publishedOrErroredIn = (from: Date, to: Date) => ({
      OR: [
        { publishedAt: { gte: from, lt: to } },
        { status: 'ERROR' as const, publishedAt: null, updatedAt: { gte: from, lt: to } },
      ],
    });

    const [
      latestFollowers,
      baselineFollowers,
      currentAnalytics,
      prevAnalytics,
      postsThisWeek,
      postsLastWeek,
      publishedInPeriod,
      erroredInPeriod,
    ] = await Promise.all([
      this.prisma.platformMetrics.findMany({
        where: { userId },
        distinct: ['platform'],
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.platformMetrics.findMany({
        where: { userId, recordedAt: { lte: periodStart } },
        distinct: ['platform'],
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.postAnalytics.aggregate({
        where: { userId, publishedAt: { gte: periodStart, lte: now } },
        _sum: { reach: true, impressions: true },
        _avg: { engagementRate: true },
      }),
      this.prisma.postAnalytics.aggregate({
        where: { userId, publishedAt: { gte: prevPeriodStart, lt: periodStart } },
        _avg: { engagementRate: true },
      }),
      this.prisma.post.count({ where: { userId, ...publishedOrErroredIn(periodStart, now) } }),
      this.prisma.post.count({ where: { userId, ...publishedOrErroredIn(prevPeriodStart, periodStart) } }),
      this.prisma.post.count({ where: { userId, status: 'PUBLISHED', ...publishedOrErroredIn(periodStart, now) } }),
      this.prisma.post.count({ where: { userId, status: 'ERROR', ...publishedOrErroredIn(periodStart, now) } }),
    ]);

    const followers = latestFollowers.reduce((s, m) => s + m.followersCount, 0);
    const baselineTotal = baselineFollowers.reduce((s, m) => s + m.followersCount, 0);
    const followersDeltaWoW = baselineTotal > 0
      ? +(((followers - baselineTotal) / baselineTotal) * 100).toFixed(2)
      : 0;

    const successDenominator = publishedInPeriod + erroredInPeriod;
    const publishSuccessRate = successDenominator > 0
      ? +((publishedInPeriod / successDenominator) * 100).toFixed(2)
      : 0;

    const result = {
      followers,
      followersDeltaWoW,
      avgEngagementRate: currentAnalytics._avg.engagementRate ?? 0,
      totalReach: currentAnalytics._sum.reach ?? 0,
      totalImpressions: currentAnalytics._sum.impressions ?? 0,
      publishSuccessRate,
      postsThisWeek,
      postsLastWeek,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', DASHBOARD_CACHE_TTL_SECONDS);
    } catch {
      // Non-fatal: caching is best-effort
    }

    return result;
  }
}
