import { Module } from '@nestjs/common';
import { PrismaModule } from '@socialdrop/prisma';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
