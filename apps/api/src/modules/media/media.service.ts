import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync, statSync, renameSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { extname } from 'path';
import { PrismaService } from '@socialdrop/prisma';

const execAsync = promisify(exec);

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv']);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadDir = process.env.UPLOAD_DIRECTORY ?? 'uploads';

  /** Full public base URL (uses APP_URL so ngrok works for Instagram/TikTok) */
  private get appUrl(): string {
    return (process.env.APP_URL ?? 'http://localhost:3333').replace(/\/$/, '');
  }

  constructor(private readonly prisma: PrismaService) {}

  // ─── Server-side video compression ────────────────────────────────────

  /**
   * Compress a video file server-side using ffmpeg.
   * Only runs if file > 20 MB.  Returns the path that should now be served
   * (may be `inputPath` unchanged if compression was skipped or failed).
   */
  private async compressVideoIfNeeded(inputPath: string): Promise<string> {
    const ext = extname(inputPath).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) return inputPath;

    let inputSize: number;
    try {
      inputSize = statSync(inputPath).size;
    } catch {
      return inputPath;
    }

    // Only compress if > 20 MB
    if (inputSize < 20 * 1024 * 1024) return inputPath;

    const outputPath = inputPath.replace(/\.[^.]+$/, '_compressed.mp4');

    try {
      await execAsync(
        `ffmpeg -i "${inputPath}" ` +
        `-vcodec libx264 -crf 23 -preset fast ` +
        `-vf "scale=-2:min(1080\\,ih)" ` +
        `-acodec aac -b:a 128k ` +
        `-movflags +faststart ` +
        `"${outputPath}" -y`,
        { timeout: 10 * 60 * 1000 }, // 10-min max
      );

      if (!existsSync(outputPath)) return inputPath;

      const outputSize = statSync(outputPath).size;

      if (outputSize < inputSize) {
        unlinkSync(inputPath);
        this.logger.log(
          `Compressed: ${(inputSize / 1024 / 1024).toFixed(1)} MB → ` +
          `${(outputSize / 1024 / 1024).toFixed(1)} MB`,
        );
        return outputPath;
      } else {
        unlinkSync(outputPath);
        return inputPath;
      }
    } catch (err: any) {
      this.logger.warn(`Compression failed (${inputPath}): ${err.message}`);
      if (existsSync(outputPath)) {
        try { unlinkSync(outputPath); } catch { /* ignore */ }
      }
      return inputPath;
    }
  }

  // ─── Upload methods ────────────────────────────────────────────────────

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

    // Background compression for videos
    if (isVideo) {
      const savedPath = join(process.cwd(), this.uploadDir, file.filename);
      this.compressVideoIfNeeded(savedPath).then((newPath) => {
        if (newPath !== savedPath) {
          const newFilename = newPath.split(/[\\/]/).pop()!;
          const newUrl = `${this.appUrl}/uploads/${newFilename}`;
          this.logger.log(`Compression done for post media: ${newUrl}`);
          // Optionally update DB record URL here
        }
      }).catch(() => { /* non-critical */ });
    }

    return media;
  }

  /** Upload a file without associating it to a post — returns the full public URL immediately,
   *  then compresses the video in the background. */
  async saveUploadStandalone(file: Express.Multer.File) {
    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.originalname);
    const url = `${this.appUrl}/uploads/${file.filename}`;

    this.logger.log(`Standalone media uploaded: ${url}`);

    const result = {
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      mediaType: isVideo ? ('VIDEO' as const) : ('IMAGE' as const),
    };

    // Compress in background — client gets the URL immediately
    if (isVideo) {
      const savedPath = join(process.cwd(), this.uploadDir, file.filename);
      this.compressVideoIfNeeded(savedPath).then((newPath) => {
        if (newPath !== savedPath) {
          const newFilename = newPath.split(/[\\/]/).pop()!;
          const newUrl = `${this.appUrl}/uploads/${newFilename}`;
          this.logger.log(`Compression done: ${newUrl}`);
        }
      }).catch(() => { /* non-critical */ });
    }

    return result;
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
