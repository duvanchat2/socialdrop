import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@socialdrop/prisma';
import { MetricsModule } from '../metrics/metrics.module.js';
import { BrainService } from './brain.service.js';
import { BrainController } from './brain.controller.js';
import { MetricsCollectorProcessor } from './metrics-collector.processor.js';
import { BrainUpdaterProcessor } from './brain-updater.processor.js';
import { BrainScheduler } from './brain.scheduler.js';
import { TranscriptionService } from './transcription.service.js';
import { UsageModule } from '../usage/usage.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MetricsModule,
    UsageModule,
    BullModule.registerQueue(
      { name: 'metrics-collector' },
      { name: 'brain-updater' },
    ),
  ],
  controllers: [BrainController],
  providers: [
    BrainService,
    TranscriptionService,
    MetricsCollectorProcessor,
    BrainUpdaterProcessor,
    BrainScheduler,
  ],
  exports: [BrainService, TranscriptionService],
})
export class BrainModule {}
