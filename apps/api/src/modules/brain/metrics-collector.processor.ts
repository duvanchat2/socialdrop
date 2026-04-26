import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BrainService } from './brain.service.js';

@Processor('metrics-collector')
export class MetricsCollectorProcessor extends WorkerHost {
  private readonly logger = new Logger(MetricsCollectorProcessor.name);

  constructor(private readonly brainService: BrainService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'collect-all') {
      this.logger.log('[MetricsCollector] Starting hourly metrics collection');
      const scriptIds = await this.brainService.findScriptsDueForMetrics();
      this.logger.log(`[MetricsCollector] Found ${scriptIds.length} scripts due for metrics`);

      let success = 0;
      let failed = 0;
      for (const id of scriptIds) {
        try {
          await this.brainService.collectMetricsForScript(id);
          success++;
        } catch {
          failed++;
        }
      }

      return { processed: scriptIds.length, success, failed };
    }

    if (job.name === 'collect-single') {
      const scriptId = job.data?.scriptId as string;
      if (!scriptId) return null;
      await this.brainService.collectMetricsForScript(scriptId);
      return { scriptId };
    }

    return null;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`[MetricsCollector] job ${job.id} failed: ${error.message}`, error.stack);
  }
}
