import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BrainService } from './brain.service.js';

@Processor('brain-updater')
export class BrainUpdaterProcessor extends WorkerHost {
  private readonly logger = new Logger(BrainUpdaterProcessor.name);

  constructor(private readonly brainService: BrainService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'update-all') {
      this.logger.log('[BrainUpdater] Sunday brain update starting');
      const userIds = await this.brainService.getActiveUserIds();
      this.logger.log(`[BrainUpdater] Processing ${userIds.length} users`);

      const results: Array<{ userId: string; status: string }> = [];
      for (const userId of userIds) {
        try {
          await this.brainService.learnFromViralScripts(userId);
          results.push({ userId, status: 'updated' });
        } catch (err: any) {
          results.push({ userId, status: `error: ${err.message}` });
        }
      }

      return { processed: userIds.length, results };
    }

    if (job.name === 'update-user') {
      const userId = job.data?.userId as string;
      if (!userId) return null;
      await this.brainService.learnFromViralScripts(userId);
      return { userId };
    }

    return null;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`[BrainUpdater] job ${job.id} failed: ${error.message}`, error.stack);
  }
}
