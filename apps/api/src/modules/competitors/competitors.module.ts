import { Module } from '@nestjs/common';
import { CompetitorsController } from './competitors.controller.js';
import { CompetitorsService } from './competitors.service.js';
import { BrainModule } from '../brain/brain.module.js';

@Module({
  imports: [BrainModule],
  controllers: [CompetitorsController],
  providers: [CompetitorsService],
  exports: [CompetitorsService],
})
export class CompetitorsModule {}
