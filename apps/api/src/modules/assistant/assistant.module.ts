import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
