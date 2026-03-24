import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(userId: string, type?: string, status?: string) {
    return this.prisma.contentItem.findMany({
      where: {
        userId,
        ...(type && { type: type as any }),
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: any) {
    return this.prisma.contentItem.create({
      data: {
        ...dto,
        userId,
        hashtags: dto.hashtags ?? [],
        tags: dto.tags ?? [],
        platforms: dto.platforms ?? [],
      },
    });
  }

  async update(id: string, dto: any) {
    return this.prisma.contentItem.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.contentItem.delete({ where: { id } });
  }

  async findOne(id: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`ContentItem ${id} not found`);
    return item;
  }

  async generateCopy(id: string) {
    const item = await this.findOne(id);
    const webhookUrl =
      this.config.get<string>('N8N_WEBHOOK_URL') || process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      this.logger.warn('N8N_WEBHOOK_URL not configured, skipping webhook');
      return { message: 'N8N_WEBHOOK_URL not configured', item };
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
    const payload = {
      contentId: item.id,
      type: item.type,
      tema: item.tema,
      platforms: item.platforms,
      callbackUrl: `${apiBase}/api/content/${item.id}/copy-callback`,
    };

    await this.prisma.contentItem.update({
      where: { id },
      data: { n8nJobId: `pending-${Date.now()}` },
    });

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.logger.log(`Webhook sent to n8n for content ${id}`);
    } catch (e: any) {
      this.logger.error(`Failed to call n8n webhook: ${e.message}`);
    }

    return { message: 'Webhook triggered', contentId: id, payload };
  }

  async handleCopyCallback(
    id: string,
    body: {
      caption?: string;
      hashtags?: string[];
      title?: string;
      tags?: string[];
    },
  ) {
    return this.prisma.contentItem.update({
      where: { id },
      data: {
        ...(body.caption !== undefined && { caption: body.caption }),
        ...(body.hashtags !== undefined && { hashtags: body.hashtags }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.tags !== undefined && { tags: body.tags }),
        copyGenerated: true,
        n8nJobId: null,
      },
    });
  }

  async scheduleAll(userId: string) {
    const drafts = await this.prisma.contentItem.findMany({
      where: { userId, status: 'DRAFT', scheduledAt: { not: null } },
    });

    await this.prisma.contentItem.updateMany({
      where: { userId, status: 'DRAFT', scheduledAt: { not: null } },
      data: { status: 'SCHEDULED' },
    });

    return { scheduled: drafts.length };
  }

  async getDriveFiles(userId: string) {
    const driveConfigs = await this.prisma.driveConfig.findMany({
      where: { userId, syncEnabled: true },
    });

    if (!driveConfigs.length) {
      return { files: [], message: 'No Drive folder configured' };
    }

    const { readdirSync, statSync } = await import('fs');
    const { join } = await import('path');
    const uploadsDir = join(
      process.cwd(),
      process.env.UPLOAD_DIRECTORY ?? './uploads',
    );

    try {
      const files = readdirSync(uploadsDir).map((name) => {
        const stat = statSync(join(uploadsDir, name));
        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(name);
        return {
          id: name,
          name,
          url: `/uploads/${name}`,
          mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
          size: stat.size,
          modifiedTime: stat.mtime,
        };
      });
      return { files, driveFolder: driveConfigs[0]?.folderId };
    } catch {
      return { files: [] };
    }
  }
}
