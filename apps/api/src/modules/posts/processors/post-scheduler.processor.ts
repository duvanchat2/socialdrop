import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@socialdrop/prisma';
import { IntegrationManager } from '@socialdrop/integrations';

interface SchedulerJobData {
  type: 'scan' | 'publish';
  postIntegrationId?: string;
}

@Processor('post-scheduler')
export class PostSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(PostSchedulerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationManager: IntegrationManager,
    @InjectQueue('post-scheduler') private readonly schedulerQueue: Queue,
  ) {
    super();
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

    try {
      const provider = this.integrationManager.getProvider(
        pi.integration.platform,
      );
      const result = await provider.post(pi.integration.accessToken, {
        text: pi.post.content,
        mediaUrls: pi.post.media.map((m) => m.url),
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
      const retryCount = pi.post.retryCount + 1;
      const maxRetries = 3;

      await this.prisma.postIntegration.update({
        where: { id: postIntegrationId },
        data: {
          status: retryCount >= maxRetries ? 'ERROR' : 'PENDING',
          errorMessage: (error as Error).message,
        },
      });

      await this.prisma.post.update({
        where: { id: pi.postId },
        data: { retryCount },
      });

      this.logger.error(
        `Failed to publish to ${pi.integration.platform}: ${(error as Error).message}`,
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
