import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '@socialdrop/prisma';
import { IntegrationManager, RefreshTokenError } from '@socialdrop/integrations';
import { DebugLogService } from '../../debug/debug-log.service.js';

const DEBUG_USER = 'demo-user';
const UPLOAD_DIR = process.env.UPLOAD_DIRECTORY ?? 'uploads';

interface SchedulerJobData {
  type: 'scan' | 'publish' | 'sequence-step';
  postIntegrationId?: string;
  sequenceId?: string;
  contactAccountId?: string;
  platform?: string;
  message?: string;
  stepIndex?: number;
}

interface DeleteMediaJobData {
  mediaUrls: string[];
}

@Processor('post-scheduler')
export class PostSchedulerProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PostSchedulerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationManager: IntegrationManager,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
    private readonly debugLog: DebugLogService,
  ) {
    super();
  }

  async onModuleInit() {
    const jobs = await this.schedulerQueue.getRepeatableJobs();
    if (!jobs.some(j => j.name === 'scan')) {
      await this.schedulerQueue.add('scan', { type: 'scan' }, { repeat: { every: 60_000 } });
      this.logger.log('[Scheduler] Recurring scan job registered (every 60s)');
    } else {
      this.logger.log('[Scheduler] Recurring scan job already active');
    }
  }

  async process(job: Job<SchedulerJobData | DeleteMediaJobData>): Promise<unknown> {
    // ─── Delayed media deletion ───────────────────────────────────────────
    if (job.name === 'delete-media') {
      return this.deleteMedia(job as Job<DeleteMediaJobData>);
    }

    const data = job.data as SchedulerJobData;

    if (data.type === 'scan') {
      return this.scanScheduledPosts();
    }

    if (data.type === 'publish' && data.postIntegrationId) {
      return this.publishPost(data.postIntegrationId);
    }

    return null;
  }

  // ─── Delete media files (called 24h after PUBLISHED) ──────────────────

  private async deleteMedia(job: Job<DeleteMediaJobData>): Promise<unknown> {
    const { mediaUrls } = job.data;
    let deleted = 0;

    for (const url of mediaUrls ?? []) {
      try {
        const filename = path.basename(url);
        const filePath = path.join(process.cwd(), UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Deleted media: ${filename}`);
          deleted++;
        }
      } catch (err: any) {
        this.logger.warn(`Could not delete ${url}: ${err.message}`);
      }
    }

    return { deleted, total: mediaUrls?.length ?? 0 };
  }

  // ─── Daily cleanup cron (3am) ─────────────────────────────────────────

  /**
   * Deletes any file in /uploads/ older than 48h that is NOT referenced by
   * a PENDING, SCHEDULED, or DRAFT post media record.
   */
  @Cron('0 3 * * *')
  async cleanupOrphanedFiles(): Promise<void> {
    const uploadsDir = path.join(process.cwd(), UPLOAD_DIR);

    let files: string[];
    try {
      files = fs.readdirSync(uploadsDir);
    } catch {
      this.logger.warn('[Cleanup] Could not read uploads dir');
      return;
    }

    const cutoff = Date.now() - 48 * 60 * 60 * 1000; // 48h ago
    let cleaned = 0;

    for (const file of files) {
      try {
        const filePath = path.join(uploadsDir, file);
        const stat = fs.statSync(filePath);

        if (stat.mtimeMs >= cutoff) continue; // too new

        // Check if any active post references this file
        const inUse = await this.prisma.media.findFirst({
          where: {
            url: { endsWith: `/${file}` },
            post: {
              status: { in: ['PENDING', 'SCHEDULED', 'DRAFT'] },
            },
          },
        });

        if (!inUse) {
          fs.unlinkSync(filePath);
          this.logger.log(`[Cleanup] Deleted orphaned: ${file}`);
          cleaned++;
        }
      } catch (err: any) {
        this.logger.warn(`[Cleanup] Error processing ${file}: ${err.message}`);
      }
    }

    this.logger.log(`[Cleanup] Done — removed ${cleaned} orphaned file(s)`);
  }

  // ─── Scheduler ────────────────────────────────────────────────────────

  private async scanScheduledPosts() {
    this.logger.log(`[Scheduler] Scanning at ${new Date().toISOString()}, checking pending posts...`);
    const pendingPosts = await this.prisma.postIntegration.findMany({
      where: {
        status: 'PENDING',
        post: {
          scheduledAt: { lte: new Date() },
          status: 'SCHEDULED',
        },
      },
      include: { post: true, integration: true },
    });

    this.logger.log(`Found ${pendingPosts.length} posts ready to publish`);
    if (pendingPosts.length > 0) {
      await this.debugLog.push(DEBUG_USER, 'log', 'Scheduler', `Scan found ${pendingPosts.length} post(s) ready to publish`);
    }

    for (const pi of pendingPosts) {
      await this.prisma.postIntegration.update({
        where: { id: pi.id },
        data: { status: 'PUBLISHING' },
      });

      await this.schedulerQueue.add('publish', {
        type: 'publish',
        postIntegrationId: pi.id,
      });
    }

    return { scanned: pendingPosts.length };
  }

  private async publishPost(postIntegrationId: string) {
    const pi = await this.prisma.postIntegration.findUniqueOrThrow({
      where: { id: postIntegrationId },
      include: {
        post: { include: { media: true } },
        integration: true,
      },
    });

    const platform = pi.integration.platform;
    const userId = pi.post.userId;
    const mediaUrls = pi.post.media.map((m) => m.url);

    await this.debugLog.push(userId, 'log', platform,
      `[${platform}] Starting publish for postId=${pi.postId} | media=${mediaUrls.join(', ') || 'none'}`);

    const provider = this.integrationManager.getProvider(platform);

    // Pre-emptively refresh token if expired or about to expire within 5 minutes
    let accessToken = pi.integration.accessToken;
    const refreshToken = pi.integration.refreshToken;
    const tokenExpiry = pi.integration.tokenExpiry;
    const fiveMinutes = 5 * 60 * 1000;

    if (tokenExpiry) {
      const msLeft = tokenExpiry.getTime() - Date.now();
      await this.debugLog.push(userId, 'log', platform,
        `[${platform}] Token expiry: ${tokenExpiry.toISOString()} (${Math.round(msLeft / 1000 / 60)} min left)`);
    } else {
      await this.debugLog.push(userId, 'warn', platform, `[${platform}] No token expiry date stored`);
    }

    if (refreshToken && tokenExpiry && tokenExpiry.getTime() - Date.now() < fiveMinutes) {
      this.logger.warn(
        `[Scheduler] Token for ${platform} integration=${pi.integration.id} ` +
        `is expired or expiring soon (expiry=${tokenExpiry.toISOString()}). Refreshing...`,
      );
      await this.debugLog.push(userId, 'warn', platform,
        `[${platform}] Token expired/expiring — refreshing (integration=${pi.integration.id})`);
      try {
        const refreshed = await provider.refreshToken(refreshToken);
        accessToken = refreshed.accessToken;
        await this.prisma.integration.update({
          where: { id: pi.integration.id },
          data: {
            accessToken: refreshed.accessToken,
            ...(refreshed.refreshToken && { refreshToken: refreshed.refreshToken }),
            ...(refreshed.tokenExpiry && { tokenExpiry: refreshed.tokenExpiry }),
          },
        });
        this.logger.log(`[Scheduler] Token refreshed for integration=${pi.integration.id}`);
        await this.debugLog.push(userId, 'log', platform, `[${platform}] Token refreshed successfully`);
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.error(`[Scheduler] Pre-emptive token refresh failed for integration=${pi.integration.id}: ${msg}`);
        await this.debugLog.push(userId, 'error', platform, `[${platform}] Token refresh failed: ${msg}`, String(err));
        // Continue with existing token — let the actual request fail and handle below
      }
    }

    await this.debugLog.push(userId, 'log', platform,
      `[${platform}] Calling provider.post() | content="${pi.post.content.slice(0, 80)}..." | mediaUrls=${JSON.stringify(mediaUrls)}`);

    // Pull YouTube metadata from the post's JSON blob (if any)
    const postMeta = (pi.post as any).metadata as { youtube?: { title?: string; description?: string; tags?: string[] } } | null;
    const postContent = {
      text: pi.post.content,
      mediaUrls,
      mediaType: pi.post.media[0]?.mediaType as 'VIDEO' | 'IMAGE' | undefined,
      ...(postMeta?.youtube && { metadata: { youtube: postMeta.youtube } }),
    };

    try {
      const result = await provider.post(accessToken, postContent);

      await this.prisma.postIntegration.update({
        where: { id: postIntegrationId },
        data: {
          status: 'PUBLISHED',
          platformPostId: result.platformPostId,
          publishedAt: new Date(),
        },
      });

      await this.updatePostStatus(pi.postId, mediaUrls);

      this.logger.log(`Published to ${platform}: ${result.platformPostId}`);
      await this.debugLog.push(userId, 'log', platform,
        `[${platform}] ✓ Published successfully — platformPostId=${result.platformPostId}`);
    } catch (error) {
      let finalError = error as Error;
      await this.debugLog.push(userId, 'error', platform,
        `[${platform}] ✗ publish failed: ${finalError.message}`, finalError.stack);

      // On 401: try to refresh token once and retry the post
      if (error instanceof RefreshTokenError && refreshToken) {
        this.logger.warn(`[Scheduler] 401 received for integration=${pi.integration.id}, attempting token refresh...`);
        await this.debugLog.push(userId, 'warn', platform,
          `[${platform}] 401 Unauthorized — attempting token refresh for integration=${pi.integration.id}`);
        try {
          const refreshed = await provider.refreshToken(refreshToken);
          await this.prisma.integration.update({
            where: { id: pi.integration.id },
            data: {
              accessToken: refreshed.accessToken,
              ...(refreshed.refreshToken && { refreshToken: refreshed.refreshToken }),
              ...(refreshed.tokenExpiry && { tokenExpiry: refreshed.tokenExpiry }),
            },
          });
          this.logger.log(`[Scheduler] Token refreshed, retrying post for integration=${pi.integration.id}`);
          await this.debugLog.push(userId, 'log', platform,
            `[${platform}] Token refreshed, retrying publish...`);

          const result = await provider.post(refreshed.accessToken, postContent);

          await this.prisma.postIntegration.update({
            where: { id: postIntegrationId },
            data: {
              status: 'PUBLISHED',
              platformPostId: result.platformPostId,
              publishedAt: new Date(),
            },
          });

          await this.updatePostStatus(pi.postId, mediaUrls);
          this.logger.log(`Published to ${platform} after token refresh: ${result.platformPostId}`);
          await this.debugLog.push(userId, 'log', platform,
            `[${platform}] ✓ Published after token refresh — platformPostId=${result.platformPostId}`);
          return;
        } catch (refreshErr) {
          const msg = (refreshErr as Error).message;
          this.logger.error(`[Scheduler] Token refresh and retry failed for integration=${pi.integration.id}: ${msg}`);
          await this.debugLog.push(userId, 'error', platform,
            `[${platform}] Token refresh + retry failed: ${msg}`, String(refreshErr));
          finalError = refreshErr as Error;
        }
      }

      const retryCount = pi.post.retryCount + 1;
      const maxRetries = 3;

      await this.prisma.postIntegration.update({
        where: { id: postIntegrationId },
        data: {
          status: retryCount >= maxRetries ? 'ERROR' : 'PENDING',
          errorMessage: finalError.message,
        },
      });

      await this.prisma.post.update({
        where: { id: pi.postId },
        data: { retryCount },
      });

      this.logger.error(`Failed to publish to ${platform}: ${finalError.message}`);
      await this.debugLog.push(userId, 'error', platform,
        `[${platform}] Final failure (retry ${retryCount}/${maxRetries}): ${finalError.message}`,
        finalError.stack);

      if (retryCount >= maxRetries) {
        await this.updatePostStatus(pi.postId, mediaUrls);
      }
    }
  }

  /**
   * Called when all integrations for a post are done.
   * If the post becomes PUBLISHED, enqueue a delayed media deletion (24h).
   */
  private async updatePostStatus(postId: string, mediaUrls: string[] = []) {
    const allIntegrations = await this.prisma.postIntegration.findMany({
      where: { postId },
    });

    const allDone = allIntegrations.every(
      (i) => i.status === 'PUBLISHED' || i.status === 'ERROR',
    );

    if (allDone) {
      const hasError = allIntegrations.some((i) => i.status === 'ERROR');
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: hasError ? 'ERROR' : 'PUBLISHED',
          publishedAt: hasError ? null : new Date(),
        },
      });

      // Delete media files 5 minutes after successful publish (enough time for CDN caching)
      if (!hasError && mediaUrls.length > 0) {
        await this.schedulerQueue.add(
          'delete-media',
          { mediaUrls },
          { delay: 5 * 60 * 1000 }, // 5 minutes
        );
        this.logger.log(`[Scheduler] Media deletion scheduled in 5min for ${mediaUrls.length} file(s) (post ${postId})`);
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Post scheduler job ${job.id} failed: ${error.message}`, error.stack);
  }
}
