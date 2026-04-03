import { Module } from '@nestjs/common';
import { CompetitorsController } from './competitors.controller.js';
import { CompetitorsService } from './competitors.service.js';

@Module({
  controllers: [CompetitorsController],
  providers: [CompetitorsService],
  exports: [CompetitorsService],
})
export class CompetitorsModule {}
