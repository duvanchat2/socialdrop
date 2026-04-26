import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@socialdrop/prisma';
import { BrainService } from './brain.service.js';
import { BrainController } from './brain.controller.js';
import { MetricsCollectorProcessor } from './metrics-collector.processor.js';
import { BrainUpdaterProcessor } from './brain-updater.processor.js';
import { BrainScheduler } from './brain.scheduler.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue(
      { name: 'metrics-collector' },
      { name: 'brain-updater' },
    ),
  ],
  controllers: [BrainController],
  providers: [
    BrainService,
    MetricsCollectorProcessor,
    BrainUpdaterProcessor,
    BrainScheduler,
  ],
  exports: [BrainService],
})
export class BrainModule {}
