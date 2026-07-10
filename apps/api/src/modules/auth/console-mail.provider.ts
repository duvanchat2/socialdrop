import { Injectable, Logger } from '@nestjs/common';
import { MailProvider, MailTemplate } from './mail-provider.interface.js';

/** Dev-mode mail provider — logs the email instead of sending it. Swap for Resend/SMTP in a later PR. */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async send(to: string, template: MailTemplate, vars: Record<string, string>): Promise<void> {
    this.logger.log(`[mail:${template}] to=${to} vars=${JSON.stringify(vars)}`);
  }
}
