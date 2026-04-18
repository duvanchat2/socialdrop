import { Module } from '@nestjs/common';
import { PrismaModule } from '@socialdrop/prisma';
import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
