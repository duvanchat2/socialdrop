import { Module } from '@nestjs/common';
import { PrismaModule } from '@socialdrop/prisma';
import { StrategyController } from './strategy.controller.js';
import { StrategyService } from './strategy.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
