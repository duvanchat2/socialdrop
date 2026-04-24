import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { PrismaModule } from '@socialdrop/prisma';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DriveModule } from '../modules/drive/drive.module.js';
import { PostsModule } from '../modules/posts/posts.module.js';
import { IntegrationsModule } from '../modules/integrations/integrations.module.js';
import { MediaModule } from '../modules/media/media.module.js';
import { StatsModule } from '../modules/stats/stats.module.js';
import { ContentModule } from '../modules/content/content.module.js';
import { BrandModule } from '../modules/brand/brand.module.js';
import { StrategyModule } from '../modules/strategy/strategy.module.js';
import { BulkModule } from '../modules/bulk/bulk.module.js';
import { AssistantModule } from '../modules/assistant/assistant.module.js';
import { MetricsModule } from '../modules/metrics/metrics.module.js';
import { CompetitorsModule } from '../modules/competitors/competitors.module.js';
import { QueueModule } from '../modules/queue/queue.module.js';
import { WebhooksModule } from '../modules/webhooks/webhook.module.js';
import { FlowsModule } from '../modules/flows/flows.module.js';
import { InboxModule } from '../modules/inbox/inbox.module.js';
import { SequencesModule } from '../modules/sequences/sequences.module.js';
import { DebugModule } from '../modules/debug/debug.module.js';
import googleConfig from '../config/google.config.js';
import redisConfig from '../config/redis.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [googleConfig, redisConfig],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIRECTORY ?? './uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    DriveModule,
    PostsModule,
    IntegrationsModule,
    MediaModule,
    StatsModule,
    ContentModule,
    BrandModule,
    StrategyModule,
    BulkModule,
    AssistantModule,
    MetricsModule,
    CompetitorsModule,
    QueueModule,
    WebhooksModule,
    FlowsModule,
    InboxModule,
    SequencesModule,
    DebugModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
