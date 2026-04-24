import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { PostSchedulerProcessor } from './processors/post-scheduler.processor.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { DebugModule } from '../debug/debug.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'post-scheduler' }),
    IntegrationsModule,
    DebugModule,
  ],
  controllers: [PostsController],
  providers: [PostsService, PostSchedulerProcessor],
  exports: [PostsService],
})
export class PostsModule {}
