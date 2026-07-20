import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required to encrypt/decrypt OAuth tokens (see docs/prs/PR-15.md)');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (a base64-encoded AES-256 key)');
  }
  return key;
}

const CIPHERTEXT_FORMAT = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

/** True if the value looks like our iv:tag:ciphertext format (vs. legacy plaintext). */
export function isEncryptedToken(value: string): boolean {
  return CIPHERTEXT_FORMAT.test(value);
}

/** AES-256-GCM encrypt. Output: base64(iv):base64(authTag):base64(ciphertext). */
export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a value produced by encryptToken(). Values that don't match the
 * iv:tag:ciphertext format are treated as legacy plaintext (rows written
 * before this PR / before the backfill script ran) and returned as-is —
 * the next write for that row re-encrypts it via encryptToken().
 * Throws if the GCM auth tag doesn't verify (tampered or corrupted ciphertext).
 */
export function decryptToken(value: string): string {
  if (!isEncryptedToken(value)) return value;

  const [ivB64, tagB64, ciphertextB64] = value.split(':');
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

/** Encrypts a token field, passing through null/undefined unchanged. */
export function encryptTokenField<T extends string | null | undefined>(value: T): T {
  return (value == null ? value : (encryptToken(value) as T));
}

/** Decrypts a token field, passing through null/undefined unchanged. */
export function decryptTokenField<T extends string | null | undefined>(value: T): T {
  return (value == null ? value : (decryptToken(value) as T));
}
