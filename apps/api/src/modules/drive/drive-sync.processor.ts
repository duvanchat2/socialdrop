import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DriveService } from './drive.service.js';

interface DriveSyncJobData {
  configId: string;
  type: 'poll' | 'full-sync';
}

@Processor('drive-sync')
export class DriveSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(DriveSyncProcessor.name);

  constructor(private readonly driveService: DriveService) {
    super();
  }

  async process(job: Job<DriveSyncJobData>): Promise<unknown> {
    const { configId, type } = job.data;
    this.logger.log(`Processing drive-sync job: ${type} for config ${configId}`);

    if (type === 'poll') {
      return this.driveService.pollForChanges(configId);
    }
    return this.driveService.syncFolder(configId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Drive sync job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
