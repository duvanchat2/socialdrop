import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MetricsService } from './metrics.service.js';

interface SyncJobData {
  userId: string;
}

@Processor('metrics-sync')
export class MetricsProcessor extends WorkerHost {
  private readonly logger = new Logger(MetricsProcessor.name);

  constructor(private readonly metricsService: MetricsService) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<unknown> {
    if (job.name === 'sync-all') {
      const userId = job.data?.userId ?? 'demo-user';
      this.logger.log(`[MetricsProcessor] sync-all for userId=${userId}`);
      return this.metricsService.syncAll(userId);
    }
    return null;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`[MetricsProcessor] job ${job.id} failed: ${error.message}`, error.stack);
  }
}
