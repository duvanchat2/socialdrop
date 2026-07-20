import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';
import { GRAPH_API_BASE, graphFetch } from '@socialdrop/integrations';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConversations(workspaceId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return contacts;
  }

  async sendReply(workspaceId: string, threadId: string, message: string): Promise<{ ok: boolean }> {
    const contact = await this.prisma.contact.findFirst({
      where: { workspaceId, accountId: threadId },
    });
    if (!contact) {
      this.logger.error(`sendReply: no Contact ${threadId} in workspace ${workspaceId}`);
      return { ok: false };
    }

    const integration = await this.prisma.integration.findFirst({
      where: { workspaceId, platform: contact.platform as any },
    });
    if (!integration) {
      this.logger.error(`sendReply: no ${contact.platform} integration for workspace ${workspaceId}`);
      return { ok: false };
    }

    const url = `${GRAPH_API_BASE}/me/messages?access_token=${integration.accessToken}`;
    try {
      const res = await graphFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: threadId }, message: { text: message } }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`sendReply failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
      }
      return { ok: res.ok };
    } catch (e) {
      this.logger.error(`sendReply failed: ${(e as Error).message}`);
      return { ok: false };
    }
  }
}
