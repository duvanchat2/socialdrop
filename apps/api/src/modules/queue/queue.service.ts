import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';
import { Platform } from '@socialdrop/shared';
import { CreateQueueSlotDto } from './dto/queue-slot.dto.js';

const COLLISION_MINUTES = 30;
const SEARCH_HORIZON_DAYS = 14;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, platform?: Platform) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.prisma.queueSlot.findMany({
      where: { userId, ...(platform ? { platform } : {}) },
      orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }, { minute: 'asc' }],
    });
  }

  async create(dto: CreateQueueSlotDto) {
    return this.prisma.queueSlot.create({
      data: {
        userId: dto.userId,
        platform: dto.platform,
        dayOfWeek: dto.dayOfWeek,
        hour: dto.hour,
        minute: dto.minute,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async remove(id: string) {
    try {
      await this.prisma.queueSlot.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`QueueSlot ${id} not found`);
    }
  }

  /**
   * Find the next free queue slot for (userId, platform), starting from `from`.
   * A slot is considered free if there is no SCHEDULED post for the same
   * platform within ±COLLISION_MINUTES of the slot's datetime.
   */
  async findNextFreeSlot(
    userId: string,
    platform: Platform,
    from: Date = new Date(),
  ) {
    const slots = await this.prisma.queueSlot.findMany({
      where: { userId, platform, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }, { minute: 'asc' }],
    });

    if (slots.length === 0) {
      throw new NotFoundException(
        'No queue slots defined for this platform. Add one in /queue.',
      );
    }

    const horizonEnd = new Date(from);
    horizonEnd.setDate(horizonEnd.getDate() + SEARCH_HORIZON_DAYS);

    const scheduledPosts = await this.prisma.post.findMany({
      where: {
        userId,
        scheduledAt: { gte: from, lte: horizonEnd },
        integrations: { some: { integration: { platform } } },
      },
      select: { scheduledAt: true },
    });
    const scheduledTimes = scheduledPosts.map((p) => p.scheduledAt.getTime());

    const hasConflict = (candidateTime: number) =>
      scheduledTimes.some(
        (t) => Math.abs(t - candidateTime) <= COLLISION_MINUTES * 60_000,
      );

    for (let dayOffset = 0; dayOffset < SEARCH_HORIZON_DAYS; dayOffset++) {
      const day = new Date(from);
      day.setDate(day.getDate() + dayOffset);

      for (const slot of slots) {
        const candidate = new Date(day);
        // Align to slot's dayOfWeek
        const daysToAdd = (slot.dayOfWeek - candidate.getDay() + 7) % 7;
        candidate.setDate(candidate.getDate() + daysToAdd);
        candidate.setHours(slot.hour, slot.minute, 0, 0);

        if (candidate.getTime() <= from.getTime()) continue;

        if (!hasConflict(candidate.getTime())) {
          return { slot, date: candidate };
        }
      }
    }

    throw new NotFoundException(
      `No free queue slot found in the next ${SEARCH_HORIZON_DAYS} days`,
    );
  }

  /**
   * Assign the given post to its next free queue slot based on its first
   * platform integration, update scheduledAt, and mark SCHEDULED.
   */
  async assign(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { integrations: { include: { integration: true } } },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);

    const firstIntegration = post.integrations[0]?.integration;
    if (!firstIntegration) {
      throw new BadRequestException('Post has no integrations/platforms');
    }

    const platform = firstIntegration.platform as Platform;
    const { slot, date } = await this.findNextFreeSlot(post.userId, platform);

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { scheduledAt: date, status: 'SCHEDULED' },
      include: { integrations: { include: { integration: true } }, media: true },
    });

    this.logger.log(
      `Post ${postId} assigned to slot ${slot.id} (${platform} ${date.toISOString()})`,
    );
    return { post: updated, slot };
  }
}
