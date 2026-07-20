import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fires alerts to a configurable channel (env `ALERT_CHANNEL=telegram|email|none`).
 * Plain HTTP against Telegram's Bot API / Resend's REST API — no extra SDK
 * dependency needed for either.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly config: ConfigService) {}

  async notify(message: string): Promise<void> {
    const channel = this.config.get<string>('ALERT_CHANNEL', 'none');
    if (channel === 'telegram') {
      await this.sendTelegram(message);
    } else if (channel === 'email') {
      await this.sendEmail(message);
    } else {
      this.logger.log(`[Alerts] (ALERT_CHANNEL not configured) ${message}`);
    }
  }

  private async sendTelegram(message: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');
    if (!token || !chatId) {
      this.logger.warn('[Alerts] ALERT_CHANNEL=telegram but TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set');
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`[Alerts] Telegram send failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
      }
    } catch (e) {
      this.logger.error(`[Alerts] Telegram send failed: ${(e as Error).message}`);
    }
  }

  private async sendEmail(message: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const to = this.config.get<string>('ALERT_EMAIL_TO');
    const from = this.config.get<string>('ALERT_EMAIL_FROM', 'alerts@socialdrop.online');
    if (!apiKey || !to) {
      this.logger.warn('[Alerts] ALERT_CHANNEL=email but RESEND_API_KEY/ALERT_EMAIL_TO not set');
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject: 'SocialDrop alert', text: message }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`[Alerts] Email send failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
      }
    } catch (e) {
      this.logger.error(`[Alerts] Email send failed: ${(e as Error).message}`);
    }
  }
}
