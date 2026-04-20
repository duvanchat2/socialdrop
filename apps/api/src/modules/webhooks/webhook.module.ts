import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';
import { FlowsModule } from '../flows/flows.module.js';

@Module({
  imports: [FlowsModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
