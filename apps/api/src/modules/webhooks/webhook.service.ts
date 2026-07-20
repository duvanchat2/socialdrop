import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService, decryptToken } from '@socialdrop/prisma';
import { FlowEngine } from '../flows/flow.engine.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly flowEngine: FlowEngine,
  ) {}

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies the `X-Hub-Signature-256` header Meta sends on every webhook
   * POST: HMAC-SHA256(FACEBOOK_APP_SECRET, rawBody), compared in constant
   * time. Without this, anyone who knows the webhook URL could forge events
   * and trigger flows/DMs. Must be checked against the exact raw bytes Meta
   * signed — re-serializing the parsed JSON body would not match.
   */
  verifySignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
    if (!rawBody || !signatureHeader) return false;

    const [algo, receivedHex] = signatureHeader.split('=');
    if (algo !== 'sha256' || !receivedHex) return false;

    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    if (!appSecret) {
      this.logger.error('[webhook] FACEBOOK_APP_SECRET not configured — cannot verify signature');
      return false;
    }

    const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const expected = Buffer.from(expectedHex, 'hex');
    const received = Buffer.from(receivedHex, 'hex');
    // timingSafeEqual throws on length mismatch — check first so a length
    // difference (also a real signal of an invalid signature) doesn't throw.
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }

  async processEvent(payload: any): Promise<void> {
    const object: string = payload?.object ?? 'unknown';
    const entries: any[] = payload?.entry ?? [];
    const platform = object === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK';

    for (const entry of entries) {
      // entry.id is the page/IG-business-account id Meta sent the event to —
      // resolve it to a real Integration so events are routed to (and DMs
      // sent as) the workspace that actually owns that account.
      const pageId: string | undefined = entry?.id;
      const integration = pageId
        ? await this.prisma.integration.findFirst({ where: { profileId: pageId, platform } })
        : null;

      if (!integration) {
        this.logger.warn(`[webhook] no Integration found for entry.id=${pageId ?? 'unknown'} platform=${platform} — skipping event(s)`);
        continue;
      }

      const workspaceId = integration.workspaceId;
      const accessToken = decryptToken(integration.accessToken);

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

        this.logger.log(`[webhook] ${type} from ${senderId} on ${object} (workspace=${workspaceId})`, WebhookService.name);
        this.flowEngine?.processEvent({ type, senderId, payload: event, platform, workspaceId, accessToken })
          .catch((e) => this.logger.error(`[webhook] flow processing failed: ${(e as Error).message}`));
      }

      for (const change of entry.changes ?? []) {
        if (change?.field === 'comments') {
          const senderId: string = change?.value?.from?.id ?? 'unknown';
          this.logger.log(`[webhook] comment from ${senderId} on ${object} (workspace=${workspaceId})`, WebhookService.name);
          this.flowEngine?.processEvent({ type: 'comment', senderId, payload: change, platform, workspaceId, accessToken })
            .catch((e) => this.logger.error(`[webhook] flow processing failed: ${(e as Error).message}`));
        }
      }
    }
  }
}
