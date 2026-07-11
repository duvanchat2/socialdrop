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
      const workspaceIds = await this.brainService.getActiveWorkspaceIds();
      this.logger.log(`[BrainUpdater] Processing ${workspaceIds.length} workspaces`);

      const results: Array<{ workspaceId: string; status: string }> = [];
      for (const workspaceId of workspaceIds) {
        try {
          await this.brainService.learnFromViralScripts(workspaceId);
          results.push({ workspaceId, status: 'updated' });
        } catch (err: any) {
          results.push({ workspaceId, status: `error: ${err.message}` });
        }
      }

      return { processed: workspaceIds.length, results };
    }

    if (job.name === 'update-user') {
      const workspaceId = job.data?.workspaceId as string;
      if (!workspaceId) return null;
      await this.brainService.learnFromViralScripts(workspaceId);
      return { workspaceId };
    }

    return null;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`[BrainUpdater] job ${job.id} failed: ${error.message}`, error.stack);
  }
}
