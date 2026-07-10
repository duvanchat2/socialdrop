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
    const integrations = await this.prisma.integration.findMany({
      where: { userId },
      select: { id: true, platform: true },
    });
    if (integrations.length === 0) return [];

    const [statusCounts, engagementByPlatform] = await Promise.all([
      this.prisma.postIntegration.groupBy({
        by: ['integrationId', 'status'],
        where: { integrationId: { in: integrations.map((i) => i.id) } },
        _count: { _all: true },
      }),
      this.prisma.postAnalytics.groupBy({
        by: ['platform'],
        where: { userId },
        _avg: { engagementRate: true },
      }),
    ]);

    const countsByIntegration = new Map<string, Map<string, number>>();
    for (const row of statusCounts) {
      if (!countsByIntegration.has(row.integrationId)) countsByIntegration.set(row.integrationId, new Map());
      countsByIntegration.get(row.integrationId)!.set(row.status, row._count._all);
    }
    const engagementMap = new Map(engagementByPlatform.map((e) => [e.platform, e._avg.engagementRate ?? 0]));

    const byPlatform = new Map<string, { platform: string; published: number; pending: number; failed: number; avgEngagementRate: number }>();
    for (const integ of integrations) {
      const entry = byPlatform.get(integ.platform) ?? {
        platform: integ.platform,
        published: 0,
        pending: 0,
        failed: 0,
        avgEngagementRate: engagementMap.get(integ.platform) ?? 0,
      };
      const counts = countsByIntegration.get(integ.id);
      if (counts) {
        entry.published += counts.get('PUBLISHED') ?? 0;
        entry.pending += counts.get('PENDING') ?? 0;
        entry.failed += counts.get('ERROR') ?? 0;
      }
      byPlatform.set(integ.platform, entry);
    }

    return [...byPlatform.values()];
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

  async getBestTimes(userId: string, platform?: string) {
    const MIN_POSTS_PER_CELL = 5;
    const TIMEZONE = 'America/Bogota';

    const rows = await this.prisma.postAnalytics.findMany({
      where: { userId, ...(platform ? { platform } : {}), publishedAt: { not: null } },
      select: { publishedAt: true, engagementRate: true },
    });

    // 7 (Sun-Sat) x 24 grid of { sum, count } accumulators
    const cells: { sum: number; count: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ sum: 0, count: 0 })),
    );

    for (const row of rows) {
      if (!row.publishedAt) continue;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        weekday: 'short',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(row.publishedAt);
      const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
      const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
      const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayStr);
      const hour = parseInt(hourStr, 10) % 24;
      if (dayIndex < 0) continue;

      const cell = cells[dayIndex][hour];
      cell.sum += row.engagementRate ?? 0;
      cell.count += 1;
    }

    const heatmap = cells.flatMap((hours, dayOfWeek) =>
      hours.map((cell, hour) => ({
        dayOfWeek,
        hour,
        avgEngagement: cell.count > 0 ? +(cell.sum / cell.count).toFixed(2) : 0,
        count: cell.count,
      })),
    );

    const topSlots = heatmap
      .filter((c) => c.count >= MIN_POSTS_PER_CELL)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3);

    return { heatmap, topSlots, minPostsPerCell: MIN_POSTS_PER_CELL };
  }
}
