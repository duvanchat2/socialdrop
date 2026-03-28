import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@socialdrop/prisma';
import { StrategyService, DayConfig } from '../strategy/strategy.service.js';
import type {
  PostDraft, DistributeAutoParams, DistributeStrategyParams, ScheduleParams,
} from './bulk.types.js';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Parse "HH:MM" into { hours, minutes } */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h ?? 9, minutes: m ?? 0 };
}

/** Build a Date from a base date string + time string, in local calendar terms */
function buildDateTime(dateStr: string, time: string): Date {
  const base = new Date(dateStr);
  const { hours, minutes } = parseTime(time);
  const d = new Date(
    base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0,
  );
  return d;
}

/** Inclusive list of date strings (YYYY-MM-DD) between start and end */
function dateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startStr);
  const end = new Date(endStr);
  // Normalize to midnight
  cur.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 0);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

@Injectable()
export class BulkService {
  private readonly logger = new Logger(BulkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: StrategyService,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {}

  distributeAuto(params: DistributeAutoParams): PostDraft[] {
    const { media, startDate, endDate, platforms, postsPerDay, times } = params;

    if (!media.length) throw new BadRequestException('No media provided');
    if (!platforms.length) throw new BadRequestException('No platforms selected');

    const dates = dateRange(startDate, endDate);
    const drafts: PostDraft[] = [];

    for (const dateStr of dates) {
      for (const platform of platforms) {
        const count = postsPerDay[platform] ?? 1;
        const platformTimes = times[platform] ?? ['09:00'];

        for (let i = 0; i < count; i++) {
          const time = platformTimes[i % platformTimes.length];
          const mediaItem = media[drafts.length % media.length];

          drafts.push({
            index: drafts.length,
            mediaUrl: mediaItem.url,
            mediaFileName: mediaItem.fileName,
            mediaType: mediaItem.mediaType,
            platform,
            scheduledAt: buildDateTime(dateStr, time).toISOString(),
            caption: '',
            ...(platform === 'YOUTUBE' ? { youtubeTitle: '', youtubeDescription: '', youtubeTags: [] } : {}),
          });
        }
      }
    }

    return drafts;
  }

  async distributeStrategy(params: DistributeStrategyParams): Promise<PostDraft[]> {
    const { media, startDate, userId } = params;

    if (!media.length) throw new BadRequestException('No media provided');

    const strategy = await this.strategyService.get(userId);
    const dayConfigs = strategy.dayConfigs as DayConfig[];

    // End date: 6 days after start (one full week)
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endStr = end.toISOString().slice(0, 10);

    const dates = dateRange(startDate, endStr);
    const drafts: PostDraft[] = [];

    for (const dateStr of dates) {
      const dayIndex = new Date(dateStr).getDay();
      const dayName = DAY_NAMES[dayIndex];
      const config = dayConfigs.find((c) => c.day === dayName);
      if (!config) continue;

      for (const platform of config.platforms) {
        for (let i = 0; i < config.postsPerDay; i++) {
          const time = config.times[i % config.times.length];
          const mediaItem = media[drafts.length % media.length];

          drafts.push({
            index: drafts.length,
            mediaUrl: mediaItem.url,
            mediaFileName: mediaItem.fileName,
            mediaType: mediaItem.mediaType,
            platform,
            scheduledAt: buildDateTime(dateStr, time).toISOString(),
            caption: '',
            contentType: config.contentType,
            ...(platform === 'YOUTUBE' ? { youtubeTitle: '', youtubeDescription: '', youtubeTags: [] } : {}),
          });
        }
      }
    }

    return drafts;
  }

  async scheduleAll(params: ScheduleParams) {
    const { drafts, userId } = params;
    if (!drafts.length) throw new BadRequestException('No drafts provided');

    // Ensure user exists
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@socialdrop.local`, name: userId },
    });

    const integrations = await this.prisma.integration.findMany({ where: { userId } });
    const intMap = new Map(integrations.map((i) => [i.platform, i]));

    const created = await Promise.all(
      drafts.map(async (draft) => {
        const integration = intMap.get(draft.platform as any);

        const post = await this.prisma.post.create({
          data: {
            userId,
            content: draft.caption,
            scheduledAt: new Date(draft.scheduledAt),
            status: 'SCHEDULED',
            integrations: integration
              ? { create: [{ integrationId: integration.id, status: 'PENDING' }] }
              : undefined,
            media: {
              create: [{
                url: draft.mediaUrl,
                mimeType: draft.mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg',
                fileName: draft.mediaFileName,
                fileSize: 0,
                mediaType: draft.mediaType,
              }],
            },
          },
          include: { integrations: { include: { integration: true } }, media: true },
        });

        return post;
      }),
    );

    // Ensure scan job is running
    await this.schedulerQueue.add('scan', { type: 'scan' }, { repeat: { every: 60_000 } });

    this.logger.log(`[Bulk] Scheduled ${created.length} posts for user ${userId}`);
    return { created: created.length, posts: created };
  }
}
