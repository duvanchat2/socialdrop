import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DriveController } from './drive.controller.js';
import { DriveService } from './drive.service.js';
import { CsvParserService } from './csv-parser.service.js';
import { DriveSyncProcessor } from './drive-sync.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'drive-sync' }),
    BullModule.registerQueue({ name: 'post-scheduler' }),
  ],
  controllers: [DriveController],
  providers: [DriveService, CsvParserService, DriveSyncProcessor],
  exports: [DriveService],
})
export class DriveModule {}
