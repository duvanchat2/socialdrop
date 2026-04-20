import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SequencesController } from './sequences.controller.js';
import { SequencesService } from './sequences.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'post-scheduler' })],
  controllers: [SequencesController],
  providers: [SequencesService],
  exports: [SequencesService],
})
export class SequencesModule {}
