import { Module } from '@nestjs/common';
import { DebugLogService } from './debug-log.service.js';
import { DebugController } from './debug.controller.js';

@Module({
  controllers: [DebugController],
  providers: [DebugLogService],
  exports: [DebugLogService],
})
export class DebugModule {}
