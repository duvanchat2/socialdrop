import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';
import { GRAPH_API_BASE, graphFetch } from '@socialdrop/integrations';

interface WebhookEvent {
  type: 'message' | 'comment' | 'postback';
  senderId: string;
  payload: any;
  platform?: string;
  /** Workspace that owns the Integration the event arrived on — scopes which flows can fire. */
  workspaceId: string;
  /** Access token of that same Integration, used for any outbound DM/reply. */
  accessToken?: string;
}

@Injectable()
export class FlowEngine {
  private readonly logger = new Logger(FlowEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  async processEvent(event: WebhookEvent): Promise<void> {
    const platform = event.platform ?? 'INSTAGRAM';
    const triggerMap: Record<string, string> = {
      message: 'DM_RECEIVED',
      comment: 'COMMENT_KEYWORD',
      postback: 'DM_RECEIVED',
    };
    const triggerType = triggerMap[event.type] ?? 'DM_RECEIVED';

    // Scoped to the workspace that owns the Integration the event arrived on —
    // otherwise a page event would fire every workspace's matching flows.
    const flows = await this.prisma.flow.findMany({
      where: { workspaceId: event.workspaceId, isActive: true, platform, trigger: triggerType },
    });

    for (const flow of flows) {
      if (flow.keyword && event.type === 'comment') {
        const text: string = event.payload?.value?.message ?? '';
        if (!text.toLowerCase().includes(flow.keyword.toLowerCase())) continue;
      }

      await this.executeFlow(flow, event);
    }
  }

  private async executeFlow(flow: any, event: WebhookEvent): Promise<void> {
    const execution = await this.prisma.flowExecution.create({
      data: {
        flowId: flow.id,
        triggeredBy: event.senderId,
        triggerType: event.type,
        status: 'RUNNING',
      },
    });

    try {
      const nodes: any[] = Array.isArray(flow.nodes) ? flow.nodes : [];
      for (const node of nodes) {
        await this.executeNode(node, event, flow);
      }

      await this.prisma.flowExecution.update({
        where: { id: execution.id },
        data: { status: 'COMPLETED' },
      });
    } catch (err) {
      this.logger.error(`Flow ${flow.id} failed: ${(err as Error).message}`);
      await this.prisma.flowExecution.update({
        where: { id: execution.id },
        data: { status: 'FAILED' },
      });
    }
  }

  private async executeNode(node: any, event: WebhookEvent, flow: any): Promise<void> {
    // Token of the Integration that received the event — not a global env var,
    // so this works for every connected account, not just one.
    const token = event.accessToken;

    switch (node.type) {
      case 'SEND_DM': {
        const message: string = (node.data?.message ?? '').replace(
          '{nombre}',
          event.payload?.sender?.name ?? 'amigo',
        );
        await this.sendDM(event.senderId, message, token);
        break;
      }
      case 'SEND_COMMENT': {
        const commentId: string = event.payload?.value?.id ?? '';
        if (commentId) await this.replyComment(commentId, node.data?.message ?? '', token);
        break;
      }
      case 'ADD_TAG': {
        const tag: string = node.data?.tag ?? '';
        if (tag) {
          await this.prisma.contact.upsert({
            where: { platform_accountId: { platform: flow.platform, accountId: event.senderId } },
            create: {
              workspaceId: flow.workspaceId,
              platform: flow.platform,
              accountId: event.senderId,
              tags: [tag],
            },
            update: { tags: { push: tag } },
          });
        }
        break;
      }
      default:
        this.logger.warn(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Throws on failure instead of swallowing it — executeFlow()'s catch is what
   * marks the FlowExecution FAILED. Logging-and-returning here meant every send
   * failure (expired token, missing permission, rate limit) was invisible: the
   * execution was recorded COMPLETED even though nothing was actually sent.
   */
  private async sendDM(recipientId: string, message: string, token?: string): Promise<void> {
    if (!token) {
      throw new Error(`sendDM: no Integration access token for recipient=${recipientId}`);
    }
    const url = `${GRAPH_API_BASE}/me/messages?access_token=${token}`;
    const res = await graphFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`sendDM failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
    }
  }

  private async replyComment(commentId: string, message: string, token?: string): Promise<void> {
    if (!token) {
      throw new Error(`replyComment: no Integration access token for comment=${commentId}`);
    }
    const url = `${GRAPH_API_BASE}/${commentId}/replies?access_token=${token}`;
    const res = await graphFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`replyComment failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
    }
  }
}
