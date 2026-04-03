import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';

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
      include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, username: string, platform: string) {
    return this.prisma.competitor.create({
      data: { userId, username, platform },
    });
  }

  async remove(id: string) {
    return this.prisma.competitor.delete({ where: { id } });
  }

  async analyze(id: string, userId: string) {
    const competitor = await this.prisma.competitor.findUnique({ where: { id } });
    if (!competitor) throw new Error('Competitor not found');

    // Fetch user's own metrics for comparison
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

      if (!response.ok) {
        throw new Error(`ZAI API error: ${response.status} ${await response.text()}`);
      }

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
