import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '@socialdrop/prisma';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadDir = process.env.UPLOAD_DIRECTORY ?? 'uploads';

  /** Full public base URL (uses APP_URL so ngrok works for Instagram/TikTok) */
  private get appUrl(): string {
    return (process.env.APP_URL ?? 'http://localhost:3333').replace(/\/$/, '');
  }

  constructor(private readonly prisma: PrismaService) {}

  async saveUpload(postId: string, file: Express.Multer.File) {
    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.originalname);
    // Full public URL so Instagram/TikTok API can download it
    const url = `${this.appUrl}/uploads/${file.filename}`;

    const media = await this.prisma.media.create({
      data: {
        postId,
        url,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
      },
    });

    this.logger.log(`Media saved: ${url} for post ${postId}`);
    return media;
  }

  /** Upload a file without associating it to a post — returns the full public URL */
  async saveUploadStandalone(file: Express.Multer.File) {
    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.originalname);
    // Full public URL so Instagram/TikTok API can download it
    const url = `${this.appUrl}/uploads/${file.filename}`;

    this.logger.log(`Standalone media uploaded: ${url}`);
    return {
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      mediaType: isVideo ? ('VIDEO' as const) : ('IMAGE' as const),
    };
  }

  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media ${id} not found`);

    // Delete physical file — URL is now a full URL, extract the filename part
    if (media.url.includes('/uploads/')) {
      const filename = media.url.split('/uploads/').pop();
      if (filename) {
        const filePath = join(process.cwd(), this.uploadDir, filename);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          this.logger.log(`Deleted file: ${filePath}`);
        }
      }
    }

    return this.prisma.media.delete({ where: { id } });
  }
}
