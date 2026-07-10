export const MAIL_PROVIDER = 'MAIL_PROVIDER';

export type MailTemplate = 'verify-email' | 'reset-password';

export interface MailProvider {
  send(to: string, template: MailTemplate, vars: Record<string, string>): Promise<void>;
}
