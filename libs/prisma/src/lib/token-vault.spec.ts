import { describe, it, expect, beforeEach } from 'vitest';
import { encryptToken, decryptToken, isEncryptedToken } from './token-vault.js';

// 32 raw bytes, base64-encoded — a valid AES-256 key for tests only.
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

describe('token-vault', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it('round-trips a plaintext token through encrypt/decrypt', () => {
    const plain = 'EAAG_super_secret_access_token_123';
    const ciphertext = encryptToken(plain);
    expect(ciphertext).not.toBe(plain);
    expect(isEncryptedToken(ciphertext)).toBe(true);
    expect(decryptToken(ciphertext)).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const plain = 'same-token-value';
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });

  it('treats legacy plaintext (not our iv:tag:ciphertext format) as a pass-through', () => {
    const legacy = 'EAAG_legacy_plaintext_token';
    expect(isEncryptedToken(legacy)).toBe(false);
    expect(decryptToken(legacy)).toBe(legacy);
  });

  it('throws when the GCM auth tag does not verify (tampered ciphertext)', () => {
    const ciphertext = encryptToken('some-token-long-enough-to-tamper-safely');
    const [iv, tag, body] = ciphertext.split(':');
    // Flip the first character (a real data bit, not a base64 padding/unused bit) to corrupt it.
    const tamperedBody = (body[0] === 'A' ? 'B' : 'A') + body.slice(1);
    const tampered = `${iv}:${tag}:${tamperedBody}`;

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws when the auth tag itself is tampered', () => {
    const ciphertext = encryptToken('some-token');
    const [iv, tag, body] = ciphertext.split(':');
    const tamperedTag = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
    const tampered = `${iv}:${tamperedTag}:${body}`;

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws a clear error when TOKEN_ENCRYPTION_KEY is missing', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken('x')).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it('throws when TOKEN_ENCRYPTION_KEY does not decode to 32 bytes', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64'); // wrong length
    expect(() => encryptToken('x')).toThrow(/32 bytes/);
  });
});
