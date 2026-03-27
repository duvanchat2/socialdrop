import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@socialdrop/prisma';
import { IntegrationManager, RefreshTokenError } from '@socialdrop/integrations';

interface SchedulerJobData {
  type: 'scan' | 'publish';
  postIntegrationId?: string;
}

@Processor('post-scheduler')
export class PostSchedulerProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PostSchedulerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationManager: IntegrationManager,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
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

    const provider = this.integrationManager.getProvider(pi.integration.platform);

    // Pre-emptively refresh token if expired or about to expire within 5 minutes
    let accessToken = pi.integration.accessToken;
    const refreshToken = pi.integration.refreshToken;
    const tokenExpiry = pi.integration.tokenExpiry;
    const fiveMinutes = 5 * 60 * 1000;

    if (refreshToken && tokenExpiry && tokenExpiry.getTime() - Date.now() < fiveMinutes) {
      this.logger.warn(
        `[Scheduler] Token for ${pi.integration.platform} integration=${pi.integration.id} ` +
        `is expired or expiring soon (expiry=${tokenExpiry.toISOString()}). Refreshing...`,
      );
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
      } catch (err) {
        this.logger.error(
          `[Scheduler] Pre-emptive token refresh failed for integration=${pi.integration.id}: ${(err as Error).message}`,
        );
        // Continue with existing token — let the actual request fail and handle below
      }
    }

    try {
      const result = await provider.post(accessToken, {
        text: pi.post.content,
        mediaUrls: pi.post.media.map((m) => m.url),
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

      this.logger.log(
        `Published to ${pi.integration.platform}: ${result.platformPostId}`,
      );
    } catch (error) {
      let finalError = error as Error;

      // On 401: try to refresh token once and retry the post
      if (error instanceof RefreshTokenError && refreshToken) {
        this.logger.warn(
          `[Scheduler] 401 received for integration=${pi.integration.id}, attempting token refresh...`,
        );
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

          const result = await provider.post(refreshed.accessToken, {
            text: pi.post.content,
            mediaUrls: pi.post.media.map((m) => m.url),
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
          this.logger.log(`Published to ${pi.integration.platform} after token refresh: ${result.platformPostId}`);
          return;
        } catch (refreshErr) {
          this.logger.error(
            `[Scheduler] Token refresh and retry failed for integration=${pi.integration.id}: ${(refreshErr as Error).message}`,
          );
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

      this.logger.error(
        `Failed to publish to ${pi.integration.platform}: ${finalError.message}`,
      );

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
    this.logger.error(
      `Post scheduler job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
