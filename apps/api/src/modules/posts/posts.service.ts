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

/** Platforms that only support ONE video per post */
const SINGLE_VIDEO_PLATFORMS = new Set(['INSTAGRAM', 'TIKTOK', 'YOUTUBE']);

function isVideo(url: string): boolean {
  return /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {}

  /**
   * Create one or more posts from a DTO.
   *
   * If the selected platforms include Instagram / TikTok / YouTube AND the
   * caller sends multiple video URLs, we automatically split them: one post
   * per video (so each platform receives a single video as required by their
   * APIs).  Images are bundled together in a separate post (carousel).
   */
  async create(userId: string, dto: CreatePostDto): Promise<object | object[]> {
    if (!userId) throw new BadRequestException('userId is required');

    const needsSplit = dto.platforms?.some(p => SINGLE_VIDEO_PLATFORMS.has(p as string));
    const allUrls = dto.mediaUrls ?? [];

    if (needsSplit && allUrls.length > 1) {
      this.logger.log(
        `Splitting ${allUrls.length} media files into individual posts ` +
        `(platforms: ${dto.platforms?.join(', ')})`,
      );
      const posts: object[] = [];
      for (let i = 0; i < allUrls.length; i++) {
        const url = allUrls[i];
        const meta = dto.filesMeta?.[i];
        posts.push(await this.createSingle(userId, {
          ...dto,
          // Per-file caption overrides top-level content
          content: meta?.caption || dto.content,
          mediaUrls: [url],
          // Per-file instagramType; fallback: auto-detect from URL
          instagramType: (meta?.instagramType as any) || (isVideo(url) ? 'REEL' : 'POST'),
          ...(meta?.youtubeTitle       && { youtubeTitle:       meta.youtubeTitle }),
          ...(meta?.youtubeTags        && { youtubeTags:        meta.youtubeTags }),
          ...(meta?.youtubeDescription && { youtubeDescription: meta.youtubeDescription }),
        }));
      }
      return posts;
    }

    return this.createSingle(userId, dto);
  }

  private async createSingle(userId: string, dto: CreatePostDto) {
    const integrations = await this.prisma.integration.findMany({
      where: { userId, platform: { in: dto.platforms as any[] } },
    });

    // Build metadata blob (YouTube fields + Instagram type)
    const metadataBlob: Record<string, unknown> = {};

    if (dto.youtubeTitle || dto.youtubeDescription || dto.youtubeTags) {
      metadataBlob.youtube = {
        title:       dto.youtubeTitle       ?? undefined,
        description: dto.youtubeDescription ?? undefined,
        tags: dto.youtubeTags
          ? dto.youtubeTags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : undefined,
      };
    }

    if (dto.instagramType) {
      metadataBlob.instagramType = dto.instagramType;
    }

    const hasMetadata = Object.keys(metadataBlob).length > 0;

    const post = await this.prisma.post.create({
      data: {
        userId,
        content:     dto.content,
        scheduledAt: new Date(dto.scheduledAt),
        status:      (dto.status ?? 'SCHEDULED') as PostStatus,
        ...(hasMetadata && { metadata: metadataBlob as any }),
        integrations: {
          create: integrations.map(int => ({
            integrationId: int.id,
            status: 'PENDING',
          })),
        },
        media: dto.mediaUrls?.length
          ? {
              create: dto.mediaUrls.map(url => ({
                url,
                mimeType:  isVideo(url) ? 'video/mp4' : 'image/jpeg',
                fileName:  url.split('/').pop()?.split('?')[0] ?? 'media',
                fileSize:  0,
                mediaType: isVideo(url) ? 'VIDEO' : 'IMAGE',
              })),
            }
          : undefined,
      },
      include: { integrations: { include: { integration: true } }, media: true },
    });

    // Trigger scan (idempotent — repeatable job already registered)
    await this.schedulerQueue.add('scan', { type: 'scan' }, { repeat: { every: 60_000 } });

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
      include: { integrations: { include: { integration: true } }, media: true },
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
        ...(dto.content    && { content:     dto.content }),
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
      },
      include: { integrations: { include: { integration: true } }, media: true },
    });

    if (dto.platforms && post.userId) {
      const integrations = await this.prisma.integration.findMany({
        where: { userId: post.userId, platform: { in: dto.platforms as any[] } },
      });
      await this.prisma.postIntegration.deleteMany({ where: { postId: id } });
      await this.prisma.postIntegration.createMany({
        data: integrations.map(int => ({
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
      data:  { status: 'PENDING', errorMessage: null },
    });
    this.logger.log(`Post ${id} queued for retry`);
    return { message: 'Post queued for retry', id };
  }
}
