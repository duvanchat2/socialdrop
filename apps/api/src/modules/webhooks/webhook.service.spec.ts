import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import { createHmac } from 'crypto';

vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/common')>();
  return {
    ...actual,
    Logger: class {
      log = vi.fn();
      warn = vi.fn();
      error = vi.fn();
    },
  };
});

import { WebhookService } from './webhook.service.js';

const APP_SECRET = 'test-app-secret';

function sign(rawBody: Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

const mockConfig = {
  get: vi.fn((key: string) => (key === 'FACEBOOK_APP_SECRET' ? APP_SECRET : undefined)),
};
const mockPrisma = { integration: { findFirst: vi.fn() } };

describe('WebhookService.verifySignature', () => {
  let service: WebhookService;
  const rawBody = Buffer.from(JSON.stringify({ object: 'page', entry: [] }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.get.mockImplementation((key: string) => (key === 'FACEBOOK_APP_SECRET' ? APP_SECRET : undefined));
    service = new WebhookService(mockConfig as any, mockPrisma as any, undefined as any);
  });

  it('accepts a valid signature computed with the configured app secret', () => {
    const signature = sign(rawBody, APP_SECRET);
    expect(service.verifySignature(rawBody, signature)).toBe(true);
  });

  it('rejects an invalid signature (wrong secret)', () => {
    const signature = sign(rawBody, 'wrong-secret');
    expect(service.verifySignature(rawBody, signature)).toBe(false);
  });

  it('rejects a signature for a different body (tampered payload)', () => {
    const signature = sign(Buffer.from('{"object":"page","entry":[{"tampered":true}]}'), APP_SECRET);
    expect(service.verifySignature(rawBody, signature)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(service.verifySignature(rawBody, undefined)).toBe(false);
  });

  it('rejects a missing raw body', () => {
    const signature = sign(rawBody, APP_SECRET);
    expect(service.verifySignature(undefined, signature)).toBe(false);
  });

  it('rejects a malformed signature header (no algo prefix)', () => {
    const raw = createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
    expect(service.verifySignature(rawBody, raw)).toBe(false);
  });

  it('rejects when FACEBOOK_APP_SECRET is not configured', () => {
    mockConfig.get.mockReturnValue(undefined);
    const signature = sign(rawBody, APP_SECRET);
    expect(service.verifySignature(rawBody, signature)).toBe(false);
  });
});
