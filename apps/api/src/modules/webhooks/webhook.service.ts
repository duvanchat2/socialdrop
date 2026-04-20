import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlowEngine } from '../flows/flow.engine.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly flowEngine: FlowEngine,
  ) {}

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  processEvent(payload: any): void {
    const object: string = payload?.object ?? 'unknown';
    const entries: any[] = payload?.entry ?? [];
    const platform = object === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK';

    for (const entry of entries) {
      for (const event of entry.messaging ?? []) {
        const senderId: string = event?.sender?.id ?? 'unknown';
        let type: 'message' | 'postback' = 'message';

        if (event?.postback) {
          type = 'postback';
        } else if (event?.message?.text !== undefined) {
          type = 'message';
        } else {
          continue;
        }

        this.logger.log(`[webhook] ${type} from ${senderId} on ${object}`, WebhookService.name);
        this.flowEngine?.processEvent({ type, senderId, payload: event, platform });
      }

      for (const change of entry.changes ?? []) {
        if (change?.field === 'comments') {
          const senderId: string = change?.value?.from?.id ?? 'unknown';
          this.logger.log(`[webhook] comment from ${senderId} on ${object}`, WebhookService.name);
          this.flowEngine?.processEvent({ type: 'comment', senderId, payload: change, platform });
        }
      }
    }
  }
}
