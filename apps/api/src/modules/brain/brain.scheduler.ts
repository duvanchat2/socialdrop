import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BrainScheduler implements OnModuleInit {
  private readonly logger = new Logger(BrainScheduler.name);

  constructor(
    @InjectQueue('metrics-collector') private readonly metricsQueue: Queue,
    @InjectQueue('brain-updater') private readonly brainQueue: Queue,
  ) {}

  async onModuleInit() {
    // Register repeatable jobs on startup
    await this.metricsQueue.add(
      'collect-all',
      {},
      {
        repeat: { pattern: '0 * * * *' }, // every hour
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    await this.brainQueue.add(
      'update-all',
      {},
      {
        repeat: { pattern: '0 0 * * 0' }, // Sunday midnight
        attempts: 2,
        backoff: { type: 'fixed', delay: 120_000 },
      },
    );

    this.logger.log('Scheduled: metrics-collector (hourly) + brain-updater (Sunday midnight)');
  }

  /** Manual trigger via NestJS scheduler (backup, in case BullMQ repeatable jobs fail) */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyMetricsBackup() {
    // BullMQ repeatable handles this; this is just a safety net log
    this.logger.debug('[BrainScheduler] Hourly metrics tick');
  }
}
