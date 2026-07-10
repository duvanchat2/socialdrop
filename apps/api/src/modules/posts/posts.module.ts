import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { PostSchedulerProcessor } from './processors/post-scheduler.processor.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { DebugModule } from '../debug/debug.module.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'post-scheduler',
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    }),
    IntegrationsModule,
    DebugModule,
  ],
  controllers: [PostsController],
  providers: [PostsService, PostSchedulerProcessor],
  exports: [PostsService],
})
export class PostsModule {}
