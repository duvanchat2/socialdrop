import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@socialdrop/prisma';
import { CompetitorsController } from './competitors.controller.js';
import {
  CompetitorsService,
  COMPETITOR_ANALYSIS_QUEUE,
} from './competitors.service.js';
import { CompetitorAnalysisProcessor } from './competitor-analysis.processor.js';
import { BrainModule } from '../brain/brain.module.js';

@Module({
  imports: [
    PrismaModule,
    BrainModule,
    BullModule.registerQueue({ name: COMPETITOR_ANALYSIS_QUEUE }),
  ],
  controllers: [CompetitorsController],
  providers: [CompetitorsService, CompetitorAnalysisProcessor],
  exports: [CompetitorsService],
})
export class CompetitorsModule {}
