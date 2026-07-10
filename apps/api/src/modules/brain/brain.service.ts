import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { MetricsService } from '../metrics/metrics.service.js';

@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  // ─── ContentBrain CRUD ────────────────────────────────────────────────

  async getBrain(userId: string) {
    const brain = await this.prisma.contentBrain.findUnique({ where: { userId } });
    if (!brain) {
      return {
        userId,
        viralHooks: [],
        viralTopics: [],
        viralFormats: [],
        bestHashtags: [],
        optimalLength: {},
        totalScripts: 0,
        viralCount: 0,
        avgEngagement: null,
        accuracyScore: null,
        lastLearnedAt: null,
        nextLearnAt: null,
        patternSummary: null,
      };
    }
    return brain;
  }

  // ─── Performance stats ────────────────────────────────────────────────

  async getPerformance(userId: string) {
    const brain = await this.getBrain(userId);

    const totalScripts = await this.prisma.generatedScript.count({ where: { userId } });
    const viralScripts = await this.prisma.generatedScript.count({
      where: { userId, isViral: true },
    });
    const publishedScripts = await this.prisma.generatedScript.count({
      where: { userId, publishedAt: { not: null } },
    });
    const withMetrics = await this.prisma.generatedScript.count({
      where: { userId, metricsAt: { not: null } },
    });

    const avgEngagementResult = await this.prisma.generatedScript.aggregate({
      where: { userId, engagementRate: { not: null } },
      _avg: { engagementRate: true },
    });

    // Recent viral scripts (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentViral = await this.prisma.generatedScript.findMany({
      where: { userId, isViral: true, publishedAt: { gte: thirtyDaysAgo } },
      orderBy: { engagementRate: 'desc' },
      take: 5,
      select: {
        id: true,
        platform: true,
        topic: true,
        hook: true,
        likes: true,
        saves: true,
        reach: true,
        engagementRate: true,
        publishedAt: true,
      },
    });

    // Learning timeline (last 6 updates)
    const learningTimeline = [
      brain.lastLearnedAt
        ? { date: brain.lastLearnedAt, event: 'Última actualización del cerebro' }
        : null,
      brain.nextLearnAt
        ? { date: brain.nextLearnAt, event: 'Próxima actualización programada', upcoming: true }
        : null,
    ].filter(Boolean);

    return {
      brain,
      stats: {
        totalScripts,
        publishedScripts,
        viralCount: viralScripts,
        scriptsWithMetrics: withMetrics,
        avgEngagement: avgEngagementResult._avg.engagementRate,
        accuracyScore: brain.accuracyScore,
        viralRate: publishedScripts > 0 ? (viralScripts / publishedScripts) * 100 : 0,
      },
      recentViral,
      learningTimeline,
    };
  }

  // ─── Script management ────────────────────────────────────────────────

  async createScript(userId: string, dto: {
    platform: string;
    topic: string;
    hook: string;
    body: string;
    cta?: string;
    hashtags?: string[];
    tone?: string;
    contentType?: string;
  }) {
    return this.prisma.generatedScript.create({
      data: {
        userId,
        platform: dto.platform,
        topic: dto.topic,
        hook: dto.hook,
        body: dto.body,
        cta: dto.cta,
        hashtags: dto.hashtags ?? [],
        tone: dto.tone,
        contentType: dto.contentType,
      },
    });
  }

  async listScripts(userId: string, filters?: { isViral?: boolean; platform?: string }) {
    return this.prisma.generatedScript.findMany({
      where: {
        userId,
        ...(filters?.isViral !== undefined && { isViral: filters.isViral }),
        ...(filters?.platform && { platform: filters.platform }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markPublished(scriptId: string, postId: string) {
    return this.prisma.generatedScript.update({
      where: { id: scriptId },
      data: { postId, publishedAt: new Date() },
    });
  }

  // ─── Metrics collection (called by BullMQ processor) ─────────────────

  async collectMetricsForScript(scriptId: string): Promise<void> {
    const script = await this.prisma.generatedScript.findUnique({ where: { id: scriptId } });
    if (!script || !script.postId) return;

    // Find integration for this user + platform
    const workspaceId = await this.prisma.resolveWorkspaceIdForUser(script.userId);
    const integration = await this.prisma.integration.findFirst({
      where: { workspaceId: workspaceId ?? undefined, platform: script.platform.toUpperCase() as any },
    });

    if (!integration?.accessToken) {
      this.logger.warn(`No integration found for ${script.userId}/${script.platform}`);
      return;
    }

    try {
      let likes = 0, saves = 0, reach = 0, follows = 0;
      let engagementRate: number | null = null;
      const platform = script.platform.toUpperCase();

      if (platform === 'INSTAGRAM') {
        const url = `https://graph.facebook.com/v19.0/${script.postId}/insights?metric=saved,reach,impressions,follows&access_token=${integration.accessToken}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };
          for (const metric of data.data ?? []) {
            const val = metric.values?.[0]?.value ?? 0;
            if (metric.name === 'saved') saves = val;
            if (metric.name === 'reach') reach = val;
            if (metric.name === 'follows') follows = val;
          }
          // Get likes from media endpoint
          const likeRes = await fetch(
            `https://graph.facebook.com/v19.0/${script.postId}?fields=like_count&access_token=${integration.accessToken}`,
          );
          if (likeRes.ok) {
            const likeData = await likeRes.json() as { like_count?: number };
            likes = likeData.like_count ?? 0;
          }
        }
        engagementRate = reach > 0 ? ((likes + saves + follows) / reach) * 100 : null;
      } else if (platform === 'FACEBOOK') {
        const fbMetrics = await this.metricsService.getFacebookPostMetrics(script.userId, script.postId);
        if (fbMetrics) {
          likes = fbMetrics.likes;
          // Reuse `saves` field to store comments and `follows` for shares — FB has no per-post saves/follows.
          saves = fbMetrics.comments;
          follows = fbMetrics.shares;
          // No per-post reach via this endpoint; use the page's latest follower count as the engagement denominator,
          // matching the same "% of audience that engaged" scale used for Instagram.
          const latestFbFollowers = await this.prisma.platformMetrics.findFirst({
            where: { userId: script.userId, platform: 'FACEBOOK' },
            orderBy: { recordedAt: 'desc' },
          });
          reach = latestFbFollowers?.followersCount ?? 0;
          const totalInteractions = likes + fbMetrics.comments + fbMetrics.shares;
          engagementRate = reach > 0 ? (totalInteractions / reach) * 100 : null;
        }
      } else if (platform === 'YOUTUBE') {
        const ytMetrics = await this.metricsService.getYouTubeVideoMetrics(script.userId, script.postId);
        if (ytMetrics) {
          likes = ytMetrics.likes;
          reach = ytMetrics.views;
          engagementRate = reach > 0 ? (likes / reach) * 100 : null;
        }
      }
      const VIRAL_THRESHOLD = 5; // 5% engagement rate = viral

      await this.prisma.generatedScript.update({
        where: { id: scriptId },
        data: {
          likes,
          saves,
          reach,
          follows,
          engagementRate,
          isViral: engagementRate !== null && engagementRate >= VIRAL_THRESHOLD,
          metricsAt: new Date(),
        },
      });

      this.logger.log(`Metrics collected for script ${scriptId}: engagement=${engagementRate?.toFixed(2)}%`);
    } catch (err: any) {
      this.logger.error(`Failed to collect metrics for script ${scriptId}: ${err.message}`);
    }
  }

  // Find scripts published 72h+ ago without metrics
  async findScriptsDueForMetrics(): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 72);

    const scripts = await this.prisma.generatedScript.findMany({
      where: {
        publishedAt: { lte: cutoff },
        postId: { not: null },
        metricsAt: null,
      },
      select: { id: true },
      take: 100,
    });

    return scripts.map((s) => s.id);
  }

  // ─── Brain learning (called by BullMQ brain-updater) ─────────────────

  async learnFromViralScripts(userId: string): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viralScripts = await this.prisma.generatedScript.findMany({
      where: { userId, isViral: true, publishedAt: { gte: thirtyDaysAgo } },
      orderBy: { engagementRate: 'desc' },
      take: 20,
    });

    if (viralScripts.length === 0) {
      this.logger.log(`No viral scripts for ${userId} in the last 30 days`);
      return;
    }

    const allScripts = await this.prisma.generatedScript.count({ where: { userId } });
    const viralCount = viralScripts.length;

    const maxEngagement = Math.max(...viralScripts.map((s) => s.engagementRate ?? 0), 1);
    const prompt = `Analiza estos ${viralCount} guiones virales de redes sociales del último mes y extrae patrones de éxito.
Los ejemplos están ordenados de mayor a menor engagement — dale más peso a los primeros (peso relativo entre paréntesis):

${viralScripts.map((s, i) => {
  const weight = Math.round(((s.engagementRate ?? 0) / maxEngagement) * 100);
  return `
---
Guión ${i + 1} (${s.platform}, engagement: ${s.engagementRate?.toFixed(1)}%, peso: ${weight})
Hook: ${s.hook}
Cuerpo: ${s.body}
CTA: ${s.cta ?? '(sin CTA)'}
Tema: ${s.topic}
Hashtags: ${s.hashtags.join(', ')}
`;
}).join('\n')}

Responde con un JSON con esta estructura exacta:
{
  "viralHooks": ["hook pattern 1", "hook pattern 2", ...],
  "viralTopics": ["topic 1", "topic 2", ...],
  "viralFormats": ["format 1", "format 2", ...],
  "bestHashtags": ["hashtag1", "hashtag2", ...],
  "patternSummary": "Resumen en 2-3 oraciones de los patrones clave que hacen viral el contenido de este usuario"
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in Claude response');

      const patterns = JSON.parse(jsonMatch[0]) as {
        viralHooks: string[];
        viralTopics: string[];
        viralFormats: string[];
        bestHashtags: string[];
        patternSummary: string;
      };

      const avgEngResult = await this.prisma.generatedScript.aggregate({
        where: { userId, engagementRate: { not: null } },
        _avg: { engagementRate: true },
      });

      // Empirical accuracy: of the scripts generated since the *previous* learning pass,
      // what % ended up beating the historical avgEngagement baseline that was in effect at the time?
      const previousBrain = await this.prisma.contentBrain.findUnique({ where: { userId } });
      let accuracyScore: number | null = null;
      if (previousBrain?.lastLearnedAt && previousBrain.avgEngagement !== null) {
        const [beatBaseline, totalMeasured] = await Promise.all([
          this.prisma.generatedScript.count({
            where: {
              userId,
              createdAt: { gte: previousBrain.lastLearnedAt },
              engagementRate: { gt: previousBrain.avgEngagement },
            },
          }),
          this.prisma.generatedScript.count({
            where: {
              userId,
              createdAt: { gte: previousBrain.lastLearnedAt },
              engagementRate: { not: null },
            },
          }),
        ]);
        accuracyScore = totalMeasured > 0 ? Math.round((beatBaseline / totalMeasured) * 100) : null;
      }

      const nextLearnAt = new Date();
      nextLearnAt.setDate(nextLearnAt.getDate() + 7); // next Sunday

      await this.prisma.contentBrain.upsert({
        where: { userId },
        update: {
          viralHooks: patterns.viralHooks,
          viralTopics: patterns.viralTopics,
          viralFormats: patterns.viralFormats,
          bestHashtags: patterns.bestHashtags,
          patternSummary: patterns.patternSummary,
          accuracyScore,
          totalScripts: allScripts,
          viralCount,
          avgEngagement: avgEngResult._avg.engagementRate,
          lastLearnedAt: new Date(),
          nextLearnAt,
        },
        create: {
          userId,
          viralHooks: patterns.viralHooks,
          viralTopics: patterns.viralTopics,
          viralFormats: patterns.viralFormats,
          bestHashtags: patterns.bestHashtags,
          patternSummary: patterns.patternSummary,
          accuracyScore,
          totalScripts: allScripts,
          viralCount,
          avgEngagement: avgEngResult._avg.engagementRate,
          lastLearnedAt: new Date(),
          nextLearnAt,
        },
      });

      this.logger.log(`Brain updated for ${userId}: ${viralCount} viral scripts analysed, accuracy=${accuracyScore ?? 'n/a'}%`);
    } catch (err: any) {
      this.logger.error(`Failed to update brain for ${userId}: ${err.message}`);
    }
  }

  // Get all user IDs that have published scripts (for cron)
  async getActiveUserIds(): Promise<string[]> {
    const results = await this.prisma.generatedScript.groupBy({
      by: ['userId'],
      where: { publishedAt: { not: null } },
    });
    return results.map((r) => r.userId);
  }
}
