import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@socialdrop/prisma';
import { IntegrationManager, RefreshTokenError } from '@socialdrop/integrations';
import { DebugLogService } from '../../debug/debug-log.service.js';

const DEBUG_USER = 'demo-user';

interface SchedulerJobData {
  type: 'scan' | 'publish' | 'sequence-step';
  postIntegrationId?: string;
  sequenceId?: string;
  contactAccountId?: string;
  platform?: string;
  message?: string;
  stepIndex?: number;
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

  async process(job: Job<SchedulerJobData>): Promise<unknown> {
    if (job.data.type === 'scan') {
      return this.scanScheduledPosts();
    }

    if (job.data.type === 'publish' && job.data.postIntegrationId) {
      return this.publishPost(job.data.postIntegrationId);
    }

    return null;
  }

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

    try {
      const result = await provider.post(accessToken, {
        text: pi.post.content,
        mediaUrls,
        mediaType: pi.post.media[0]?.mediaType as 'VIDEO' | 'IMAGE' | undefined,
      });

      await this.prisma.postIntegration.update({
        where: { id: postIntegrationId },
        data: {
          status: 'PUBLISHED',
          platformPostId: result.platformPostId,
          publishedAt: new Date(),
        },
      });

      await this.updatePostStatus(pi.postId);

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

          const result = await provider.post(refreshed.accessToken, {
            text: pi.post.content,
            mediaUrls,
            mediaType: pi.post.media[0]?.mediaType as 'VIDEO' | 'IMAGE' | undefined,
          });

          await this.prisma.postIntegration.update({
            where: { id: postIntegrationId },
            data: {
              status: 'PUBLISHED',
              platformPostId: result.platformPostId,
              publishedAt: new Date(),
            },
          });

          await this.updatePostStatus(pi.postId);
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
        await this.updatePostStatus(pi.postId);
      }
    }
  }

  private async updatePostStatus(postId: string) {
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
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Post scheduler job ${job.id} failed: ${error.message}`, error.stack);
  }
}
