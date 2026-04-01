import { Injectable } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';

export interface DayConfig {
  day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  contentType: 'VALUE' | 'LEADS' | 'SALES' | 'ANY';
  platforms: string[];
  postsPerDay: number;
  times: string[];
}

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

const DEFAULT_CONFIGS: DayConfig[] = DAYS.map((day) => ({
  day,
  contentType: 'ANY',
  platforms: ['INSTAGRAM'],
  postsPerDay: 1,
  times: ['09:00'],
}));

@Injectable()
export class StrategyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const strategy = await this.prisma.contentStrategy.findUnique({ where: { userId } });
    if (!strategy) {
      return { userId, dayConfigs: DEFAULT_CONFIGS };
    }
    return {
      ...strategy,
      dayConfigs: strategy.dayConfigs as unknown as DayConfig[],
    };
  }

  async save(userId: string, dayConfigs: DayConfig[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = dayConfigs as any;
    return this.prisma.contentStrategy.upsert({
      where: { userId },
      update: { dayConfigs: json },
      create: { userId, dayConfigs: json },
    });
  }
}
