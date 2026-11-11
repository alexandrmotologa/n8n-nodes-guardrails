import * as crypto from 'node:crypto';

export interface VaultEntity {
  token: string;
  type: string;
  original: string;
  maskedAt: string;
}

export interface VaultPayload {
  version: number;
  createdAt: string;
  mapping: Record<string, string>;
  entities: VaultEntity[];
}

const DEFAULT_SECRET = 'n8n-guardrails-ephemeral-key-seed-v1';

function deriveKey(secret?: string): Buffer {
  const chosenSecret = secret && secret.trim().length > 0 ? secret.trim() : DEFAULT_SECRET;
  return crypto.createHash('sha256').update(chosenSecret).digest();
}

/**
 * Encrypts a vault mapping into a compact authenticated token string.
 * Format: v1.<iv_base64url>.<tag_base64url>.<ciphertext_base64url>
 */
export function encryptVault(payload: VaultPayload, secret?: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonString = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Decrypts and authenticates a vault token string.
 * Throws an Error if tampered with or corrupted.
 */
export function decryptVault(token: string, secret?: string): VaultPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid vault token: empty or not a string');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported or malformed vault token format');
  }

  const [, ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  if (iv.length !== 12) {
    throw new Error('Invalid initialization vector length');
  }
  if (tag.length !== 16) {
    throw new Error('Invalid authentication tag length');
  }

  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString('utf8')) as VaultPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.mapping) {
      throw new Error('Decrypted vault payload is corrupted');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to decrypt vault token: ${(error as Error).message}`);
  }
}
