import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PostStatus } from '@socialdrop/shared';
import { PrismaService } from '@socialdrop/prisma';
import { CreatePostDto, UpdatePostDto } from '@socialdrop/shared';

interface FindAllOptions {
  status?: PostStatus;
  from?: Date;
  to?: Date;
  limit?: number;
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {}

  async create(userId: string, dto: CreatePostDto) {
    if (!userId) throw new BadRequestException('userId is required');

    const integrations = await this.prisma.integration.findMany({
      where: { userId, platform: { in: dto.platforms as any[] } },
    });

    const post = await this.prisma.post.create({
      data: {
        userId,
        content: dto.content,
        scheduledAt: new Date(dto.scheduledAt),
        status: 'SCHEDULED',
        integrations: {
          create: integrations.map((int) => ({
            integrationId: int.id,
            status: 'PENDING',
          })),
        },
        // Save external URLs as Media records so the scheduler can access them
        media: dto.mediaUrls?.length
          ? {
              create: dto.mediaUrls.map((url) => {
                const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
                return {
                  url,
                  mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
                  fileName: url.split('/').pop()?.split('?')[0] ?? 'media',
                  fileSize: 0,
                  mediaType: isVideo ? 'VIDEO' : 'IMAGE',
                };
              }),
            }
          : undefined,
      },
      include: { integrations: { include: { integration: true } }, media: true },
    });

    // Enqueue the scan job to pick it up when the time comes
    await this.schedulerQueue.add(
      'scan',
      { type: 'scan' },
      { repeat: { every: 60_000 } },
    );

    this.logger.log(`Post created: ${post.id} scheduled for ${post.scheduledAt}`);
    return post;
  }

  async findAll(userId: string, opts: FindAllOptions = {}) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.prisma.post.findMany({
      where: {
        userId,
        ...(opts.status && { status: opts.status }),
        ...(opts.from || opts.to
          ? { scheduledAt: { ...(opts.from && { gte: opts.from }), ...(opts.to && { lte: opts.to }) } }
          : {}),
      },
      include: {
        integrations: { include: { integration: true } },
        media: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: opts.limit ?? 100,
    });
  }

  async getCalendar(userId: string, from: Date, to: Date) {
    return this.prisma.post.findMany({
      where: { userId, scheduledAt: { gte: from, lte: to } },
      include: { integrations: { include: { integration: true } }, media: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        integrations: { include: { integration: true } },
        media: true,
      },
    });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  async update(id: string, dto: UpdatePostDto) {
    const post = await this.findOne(id);
    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot edit an already published post');
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...(dto.content && { content: dto.content }),
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
      },
      include: { integrations: { include: { integration: true } }, media: true },
    });

    // Update platform integrations if platforms changed
    if (dto.platforms && post.userId) {
      const integrations = await this.prisma.integration.findMany({
        where: { userId: post.userId, platform: { in: dto.platforms as any[] } },
      });

      await this.prisma.postIntegration.deleteMany({ where: { postId: id } });
      await this.prisma.postIntegration.createMany({
        data: integrations.map((int) => ({
          postId: id,
          integrationId: int.id,
          status: 'PENDING' as const,
        })),
      });
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.post.delete({ where: { id } });
  }

  async retry(id: string) {
    const post = await this.findOne(id);
    if (post.status !== 'ERROR') {
      throw new BadRequestException('Only failed posts can be retried');
    }

    await this.prisma.post.update({
      where: { id },
      data: { status: 'SCHEDULED', retryCount: 0, errorMessage: null },
    });

    await this.prisma.postIntegration.updateMany({
      where: { postId: id, status: 'ERROR' },
      data: { status: 'PENDING', errorMessage: null },
    });

    this.logger.log(`Post ${id} queued for retry`);
    return { message: 'Post queued for retry', id };
  }
}
