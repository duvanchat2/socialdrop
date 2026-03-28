import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@socialdrop/prisma';
import { BulkController } from './bulk.controller.js';
import { BulkService } from './bulk.service.js';
import { StrategyModule } from '../strategy/strategy.module.js';

@Module({
  imports: [
    PrismaModule,
    StrategyModule,
    BullModule.registerQueue({ name: 'post-scheduler' }),
  ],
  controllers: [BulkController],
  providers: [BulkService],
})
export class BulkModule {}
