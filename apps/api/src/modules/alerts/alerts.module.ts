import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlertsService } from './alerts.service.js';
import { DeadLetterService } from './dead-letter.service.js';
import { DeadLetterController } from './dead-letter.controller.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'post-scheduler' })],
  controllers: [DeadLetterController],
  providers: [AlertsService, DeadLetterService],
  exports: [AlertsService, DeadLetterService],
})
export class AlertsModule {}
