import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { MetricsProcessor } from './metrics.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'metrics-sync' }),
  ],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsProcessor],
  exports: [MetricsService],
})
export class MetricsModule {}
