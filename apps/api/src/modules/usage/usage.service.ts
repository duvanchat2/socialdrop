import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';

export type UsageMetric = 'competitor_analysis' | 'script_generation' | 'assistant_message';

const DEFAULT_LIMITS: Record<UsageMetric, number> = {
  competitor_analysis: 20,
  script_generation: 200,
  assistant_message: 500,
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private limitFor(metric: UsageMetric): number {
    const envKey = `USAGE_LIMIT_${metric.toUpperCase()}`;
    const raw = this.config.get<string>(envKey);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMITS[metric];
  }

  async getUsage(userId: string): Promise<Array<{ metric: string; period: string; count: number; limit: number }>> {
    const period = currentPeriod();
    const counters = await this.prisma.usageCounter.findMany({ where: { userId, period } });
    const byMetric = new Map(counters.map((c) => [c.metric, c.count]));
    return (Object.keys(DEFAULT_LIMITS) as UsageMetric[]).map((metric) => ({
      metric,
      period,
      count: byMetric.get(metric) ?? 0,
      limit: this.limitFor(metric),
    }));
  }

  /** Throws 403 if the user is at or over quota for this metric this period; otherwise increments and continues. */
  async consume(userId: string, metric: UsageMetric): Promise<void> {
    const period = currentPeriod();
    const limit = this.limitFor(metric);

    const counter = await this.prisma.usageCounter.upsert({
      where: { userId_metric_period: { userId, metric, period } },
      update: {},
      create: { userId, metric, period, count: 0 },
    });

    if (counter.count >= limit) {
      throw new ForbiddenException(
        `Límite mensual alcanzado para ${metric} (${limit}/mes). Se restablece el próximo mes.`,
      );
    }

    await this.prisma.usageCounter.update({
      where: { userId_metric_period: { userId, metric, period } },
      data: { count: { increment: 1 } },
    });
  }
}
