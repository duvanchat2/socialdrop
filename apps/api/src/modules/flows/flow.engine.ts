import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';

interface WebhookEvent {
  type: 'message' | 'comment' | 'postback';
  senderId: string;
  payload: any;
  platform?: string;
}

@Injectable()
export class FlowEngine {
  private readonly logger = new Logger(FlowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async processEvent(event: WebhookEvent): Promise<void> {
    const platform = event.platform ?? 'INSTAGRAM';
    const triggerMap: Record<string, string> = {
      message: 'DM_RECEIVED',
      comment: 'COMMENT_KEYWORD',
      postback: 'DM_RECEIVED',
    };
    const triggerType = triggerMap[event.type] ?? 'DM_RECEIVED';

    const flows = await this.prisma.flow.findMany({
      where: { isActive: true, platform, trigger: triggerType },
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
    const token = this.config.get<string>('FACEBOOK_ACCESS_TOKEN');

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
              userId: flow.userId,
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

  private async sendDM(recipientId: string, message: string, token?: string): Promise<void> {
    if (!token) return;
    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }),
      });
    } catch (e) {
      this.logger.error(`sendDM failed: ${(e as Error).message}`);
    }
  }

  private async replyComment(commentId: string, message: string, token?: string): Promise<void> {
    if (!token) return;
    const url = `https://graph.facebook.com/v18.0/${commentId}/replies?access_token=${token}`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
    } catch (e) {
      this.logger.error(`replyComment failed: ${(e as Error).message}`);
    }
  }
}
