import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync, statSync, renameSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '@socialdrop/prisma';

const execAsync = promisify(exec);

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

    // Compress video in background — does not block response
    if (isVideo) {
      const filePath = join(process.cwd(), this.uploadDir, file.filename);
      this.compressVideoBackground(filePath).catch(() => {/* logged inside */});
    }

    return media;
  }

  /** Upload a file without associating it to a post — returns the full public URL */
  async saveUploadStandalone(file: Express.Multer.File) {
    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.originalname);
    const url = `${this.appUrl}/uploads/${file.filename}`;

    this.logger.log(`Standalone media uploaded: ${url}`);

    // Compress video in background — does not block the upload response
    if (isVideo) {
      const filePath = join(process.cwd(), this.uploadDir, file.filename);
      this.compressVideoBackground(filePath).catch(() => {/* logged inside */});
    }

    return {
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      mediaType: isVideo ? ('VIDEO' as const) : ('IMAGE' as const),
    };
  }

  /**
   * Run ffmpeg compression on a video file in-place.
   * If the compressed output is smaller, it replaces the original (URL unchanged).
   * Falls back silently if ffmpeg is unavailable or compression fails.
   */
  private async compressVideoBackground(filePath: string): Promise<void> {
    const outputPath = `${filePath}.compressed.mp4`;
    try {
      await execAsync(
        `ffmpeg -i "${filePath}" -vcodec libx264 -crf 23 -preset fast -vf "scale=-2:min(1080\\,ih)" -acodec aac -b:a 128k -movflags +faststart "${outputPath}" -y`,
        { timeout: 10 * 60 * 1000 }, // 10-minute timeout
      );

      if (!existsSync(outputPath)) {
        this.logger.warn(`Compression produced no output for ${filePath}`);
        return;
      }

      const inputSize = statSync(filePath).size;
      const outputSize = statSync(outputPath).size;

      if (outputSize < inputSize * 0.9) {
        renameSync(outputPath, filePath); // replace original in-place (URL stays same)
        this.logger.log(
          `Video compressed: ${filePath} ${(inputSize / 1024 / 1024).toFixed(1)} MB → ${(outputSize / 1024 / 1024).toFixed(1)} MB`,
        );
      } else {
        unlinkSync(outputPath); // not worth replacing
        this.logger.log(`Compression skipped (no significant gain): ${filePath}`);
      }
    } catch (err) {
      this.logger.warn(`Video compression failed for ${filePath}: ${(err as Error).message}`);
      try { if (existsSync(outputPath)) unlinkSync(outputPath); } catch { /* ignore */ }
    }
  }

  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media ${id} not found`);

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
