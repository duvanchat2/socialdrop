import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';

interface IngestPostDto {
  postId: string;
  caption?: string;
  mediaType?: string;
  likes?: number;
  comments?: number;
  hashtags?: string[];
  publishedAt?: string;
  thumbnail?: string;
  url?: string;
}

interface IngestDto {
  userId: string;
  platform: string;
  profile: {
    username: string;
    displayName?: string;
    followers?: number;
    following?: number;
    postsCount?: number;
    bio?: string;
    avatar?: string;
  };
  posts: IngestPostDto[];
}

@Injectable()
export class CompetitorsService {
  private readonly logger = new Logger(CompetitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string) {
    return this.prisma.competitor.findMany({
      where: { userId },
      include: {
        analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, username: string, platform: string) {
    return this.prisma.competitor.upsert({
      where: { userId_username_platform: { userId, username, platform } },
      create: { userId, username, platform },
      update: { isActive: true },
    });
  }

  async remove(id: string) {
    return this.prisma.competitor.delete({ where: { id } });
  }

  /**
   * Receives scraped data from the Chrome extension.
   * Upserts the competitor profile and bulk-upserts posts.
   */
  async ingest(data: IngestDto) {
    const { userId, platform, profile, posts } = data;

    // Upsert competitor profile
    const competitor = await this.prisma.competitor.upsert({
      where: {
        userId_username_platform: {
          userId,
          username: profile.username,
          platform,
        },
      },
      create: {
        userId,
        platform,
        username: profile.username,
        displayName: profile.displayName,
        followers: profile.followers,
        following: profile.following,
        postsCount: profile.postsCount,
        bio: profile.bio,
        avatar: profile.avatar,
      },
      update: {
        displayName: profile.displayName ?? undefined,
        followers: profile.followers ?? undefined,
        following: profile.following ?? undefined,
        postsCount: profile.postsCount ?? undefined,
        bio: profile.bio ?? undefined,
        avatar: profile.avatar ?? undefined,
      },
    });

    // Upsert posts
    let imported = 0;
    for (const p of posts) {
      if (!p.postId) continue;
      await this.prisma.competitorPost.upsert({
        where: { postId: p.postId },
        create: {
          competitorId: competitor.id,
          postId: p.postId,
          caption: p.caption,
          mediaType: p.mediaType ?? 'IMAGE',
          likes: p.likes ?? 0,
          comments: p.comments ?? 0,
          hashtags: p.hashtags ?? [],
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : new Date(),
          thumbnail: p.thumbnail,
          url: p.url,
        },
        update: {
          likes: p.likes ?? undefined,
          comments: p.comments ?? undefined,
          caption: p.caption ?? undefined,
          hashtags: p.hashtags ?? undefined,
        },
      });
      imported++;
    }

    this.logger.log(`[Ingest] ${competitor.username}@${platform}: ${imported} posts`);
    return { competitorId: competitor.id, imported };
  }

  /**
   * Full analysis based on ingested posts + AI summary.
   */
  async analyzeFromPosts(id: string) {
    const competitor = await this.prisma.competitor.findUnique({
      where: { id },
      include: { posts: { orderBy: { publishedAt: 'desc' }, take: 200 } },
    });
    if (!competitor) throw new NotFoundException('Competitor not found');

    const posts = competitor.posts;
    if (posts.length === 0) {
      return { message: 'No posts ingested yet. Use the Chrome extension to scrape data.' };
    }

    // Best posting times (hour of day, avg engagement)
    const hourBuckets: Record<number, { total: number; count: number }> = {};
    const dayBuckets: Record<number, { total: number; count: number }> = {};
    const formatBuckets: Record<string, { total: number; count: number }> = {};
    const hashtagMap: Record<string, { count: number; totalEng: number }> = {};

    for (const p of posts) {
      const eng = p.likes + p.comments;
      const h = p.publishedAt.getUTCHours();
      const d = p.publishedAt.getUTCDay();

      if (!hourBuckets[h]) hourBuckets[h] = { total: 0, count: 0 };
      hourBuckets[h].total += eng;
      hourBuckets[h].count++;

      if (!dayBuckets[d]) dayBuckets[d] = { total: 0, count: 0 };
      dayBuckets[d].total += eng;
      dayBuckets[d].count++;

      const fmt = p.mediaType;
      if (!formatBuckets[fmt]) formatBuckets[fmt] = { total: 0, count: 0 };
      formatBuckets[fmt].total += eng;
      formatBuckets[fmt].count++;

      for (const tag of p.hashtags) {
        if (!hashtagMap[tag]) hashtagMap[tag] = { count: 0, totalEng: 0 };
        hashtagMap[tag].count++;
        hashtagMap[tag].totalEng += eng;
      }
    }

    const avgEng = (b: { total: number; count: number }) =>
      b.count > 0 ? Math.round(b.total / b.count) : 0;

    const bestHour = Object.entries(hourBuckets)
      .sort((a, b) => avgEng(b[1]) - avgEng(a[1]))[0]?.[0];

    const bestDay = Object.entries(dayBuckets)
      .sort((a, b) => avgEng(b[1]) - avgEng(a[1]))[0]?.[0];

    const bestFormat = Object.entries(formatBuckets)
      .sort((a, b) => avgEng(b[1]) - avgEng(a[1]))[0]?.[0];

    const topHashtags = Object.entries(hashtagMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([tag, s]) => ({ tag, count: s.count, avgEngagement: Math.round(s.totalEng / s.count) }));

    const topPosts = [...posts]
      .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
      .slice(0, 5);

    const totalEng = posts.reduce((s, p) => s + p.likes + p.comments, 0);
    const engRate = competitor.followers && competitor.followers > 0
      ? ((totalEng / posts.length / competitor.followers) * 100).toFixed(2)
      : null;

    const now = new Date();
    const oldestPost = posts[posts.length - 1]?.publishedAt;
    const weeksSince = oldestPost
      ? Math.max(1, (now.getTime() - oldestPost.getTime()) / (7 * 24 * 3600 * 1000))
      : 1;
    const postsPerWeek = (posts.length / weeksSince).toFixed(1);

    const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return {
      competitorId: id,
      username: competitor.username,
      postsAnalyzed: posts.length,
      engagementRate: engRate ? `${engRate}%` : null,
      postsPerWeek,
      bestPostingTime: bestHour != null
        ? { hour: Number(bestHour), label: `${bestHour}:00 UTC` }
        : null,
      bestDay: bestDay != null
        ? { day: Number(bestDay), label: DAYS[Number(bestDay)] }
        : null,
      bestFormat: bestFormat ?? null,
      formats: Object.entries(formatBuckets).map(([fmt, s]) => ({
        format: fmt,
        count: s.count,
        avgEngagement: avgEng(s),
      })),
      topHashtags,
      topPosts: topPosts.map((p) => ({
        postId: p.postId,
        url: p.url,
        thumbnail: p.thumbnail,
        likes: p.likes,
        comments: p.comments,
        caption: p.caption?.slice(0, 120),
        mediaType: p.mediaType,
        hashtags: p.hashtags,
        publishedAt: p.publishedAt,
      })),
      hourHeatmap: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        avgEngagement: avgEng(hourBuckets[h] ?? { total: 0, count: 0 }),
        count: hourBuckets[h]?.count ?? 0,
      })),
      dayHeatmap: Array.from({ length: 7 }, (_, d) => ({
        day: d,
        label: DAYS[d],
        avgEngagement: avgEng(dayBuckets[d] ?? { total: 0, count: 0 }),
        count: dayBuckets[d]?.count ?? 0,
      })),
    };
  }

  /**
   * Trends across all competitors for a user.
   */
  async getTrends(userId: string) {
    const competitors = await this.prisma.competitor.findMany({
      where: { userId },
      include: { posts: { orderBy: { publishedAt: 'desc' }, take: 100 } },
    });

    const globalHashtags: Record<string, number> = {};
    const globalFormats: Record<string, number> = {};
    const globalHours: Record<number, number> = {};

    for (const c of competitors) {
      for (const p of c.posts) {
        for (const tag of p.hashtags) {
          globalHashtags[tag] = (globalHashtags[tag] ?? 0) + 1;
        }
        globalFormats[p.mediaType] = (globalFormats[p.mediaType] ?? 0) + 1;
        const h = p.publishedAt.getUTCHours();
        globalHours[h] = (globalHours[h] ?? 0) + 1;
      }
    }

    const topHashtags = Object.entries(globalHashtags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));

    const topFormats = Object.entries(globalFormats)
      .sort((a, b) => b[1] - a[1])
      .map(([format, count]) => ({ format, count }));

    const bestHour = Object.entries(globalHours)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      topHashtags,
      topFormats,
      bestHour: bestHour ? { hour: Number(bestHour[0]), posts: bestHour[1] } : null,
      totalPostsAnalyzed: competitors.reduce((s, c) => s + c.posts.length, 0),
    };
  }

  /**
   * AI-powered analysis (existing functionality).
   */
  async analyze(id: string, userId: string) {
    const competitor = await this.prisma.competitor.findUnique({ where: { id } });
    if (!competitor) throw new NotFoundException('Competitor not found');

    const userMetrics = await this.prisma.platformMetrics.findFirst({
      where: { userId, platform: competitor.platform },
      orderBy: { recordedAt: 'desc' },
    });

    const apiKey = this.config.get<string>('ZAI_API_KEY');
    const baseURL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    const userPrompt = `Analyze this competitor profile and provide actionable insights:

Competitor: @${competitor.username}
Platform: ${competitor.platform}
Followers: ${competitor.followers ?? 'unknown'}
Display Name: ${competitor.displayName ?? competitor.username}

${userMetrics ? `My own metrics on ${competitor.platform}: ${userMetrics.followersCount} followers` : ''}

Return ONLY a valid JSON object with this structure (no markdown, no extra text):
{
  "hooks": ["hook1", "hook2", "hook3"],
  "themes": ["theme1", "theme2", "theme3"],
  "bestFormats": ["format1", "format2"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "summary": "A brief 2-3 sentence summary of their strategy and what makes them successful."
}`;

    try {
      const response = await fetch(baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'glm-4-plus',
          messages: [
            {
              role: 'system',
              content: 'You are a social media competitive intelligence analyst. Analyze competitor profiles and provide insights in Spanish. Always respond with valid JSON only.',
            },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) throw new Error(`ZAI API error: ${response.status} ${await response.text()}`);

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = data.choices?.[0]?.message?.content ?? '{}';
      let parsed: { hooks?: string[]; themes?: string[]; bestFormats?: string[]; recommendations?: string[]; summary?: string };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        parsed = { hooks: [], themes: [], bestFormats: [], recommendations: [], summary: raw.slice(0, 500) };
      }

      const analysis = await this.prisma.competitorAnalysis.create({
        data: {
          competitorId: id,
          summary: parsed.summary ?? '',
          hooks: parsed.hooks ?? [],
          themes: parsed.themes ?? [],
          bestFormats: parsed.bestFormats ?? [],
          recommendations: parsed.recommendations ?? [],
        },
      });

      this.logger.log(`[Competitors] Analysis created for ${competitor.username}`);
      return analysis;
    } catch (err) {
      this.logger.error(`[Competitors] Analysis failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async benchmark(userId: string) {
    const competitors = await this.prisma.competitor.findMany({ where: { userId } });

    const userMetricsByPlatform = new Map<string, { followersCount: number; platform: string }>();
    const platforms = [...new Set(competitors.map((c) => c.platform))];
    await Promise.all(
      platforms.map(async (p) => {
        const m = await this.prisma.platformMetrics.findFirst({
          where: { userId, platform: p },
          orderBy: { recordedAt: 'desc' },
        });
        if (m) userMetricsByPlatform.set(p, m);
      }),
    );

    return {
      userId,
      myMetrics: Object.fromEntries(userMetricsByPlatform),
      competitors: competitors.map((c) => ({
        id: c.id,
        username: c.username,
        platform: c.platform,
        followers: c.followers ?? null,
        myFollowers: userMetricsByPlatform.get(c.platform)?.followersCount ?? null,
      })),
    };
  }
}
