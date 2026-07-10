import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageModule } from '../usage/usage.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

@Module({
  imports: [ConfigModule, UsageModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
