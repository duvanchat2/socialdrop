import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@socialdrop/prisma';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getConversations(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return contacts;
  }

  async sendReply(threadId: string, message: string): Promise<{ ok: boolean }> {
    const token = this.config.get<string>('FACEBOOK_ACCESS_TOKEN');
    if (!token) return { ok: false };

    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: threadId }, message: { text: message } }),
      });
      return { ok: res.ok };
    } catch (e) {
      this.logger.error(`sendReply failed: ${(e as Error).message}`);
      return { ok: false };
    }
  }
}
