import { describe, it, expect } from 'vitest';
import { encryptVault, decryptVault, VaultPayload } from '../nodes/Guardrails/utils/crypto';

describe('Cryptographic Ephemeral Vault', () => {
  const samplePayload: VaultPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    mapping: {
      '{{EMAIL_1}}': 'alice@example.com',
      '{{CREDIT_CARD_1}}': '4532015112830366',
    },
    entities: [
      {
        token: '{{EMAIL_1}}',
        type: 'EMAIL',
        original: 'alice@example.com',
        maskedAt: new Date().toISOString(),
      },
    ],
  };

  it('encrypts and decrypts with the default key', () => {
    const token = encryptVault(samplePayload);
    expect(typeof token).toBe('string');
    expect(token.startsWith('v1.')).toBe(true);

    const decrypted = decryptVault(token);
    expect(decrypted.version).toBe(1);
    expect(decrypted.mapping['{{EMAIL_1}}']).toBe('alice@example.com');
    expect(decrypted.mapping['{{CREDIT_CARD_1}}']).toBe('4532015112830366');
  });

  it('encrypts and decrypts with a custom secret key', () => {
    const customSecret = 'my-ultra-secure-passphrase-2026';
    const token = encryptVault(samplePayload, customSecret);

    const decrypted = decryptVault(token, customSecret);
    expect(decrypted.mapping['{{EMAIL_1}}']).toBe('alice@example.com');

    // Fails with wrong key
    expect(() => decryptVault(token, 'wrong-key')).toThrow();
  });

  it('detects tampering and rejects invalid payloads', () => {
    const token = encryptVault(samplePayload);
    const parts = token.split('.');

    // Tamper with ciphertext
    const tamperedCiphertext = parts[3].substring(0, parts[3].length - 2) + 'AA';
    const tamperedToken = [parts[0], parts[1], parts[2], tamperedCiphertext].join('.');

    expect(() => decryptVault(tamperedToken)).toThrow(/Failed to decrypt vault token/);
  });

  it('rejects malformed token strings', () => {
    expect(() => decryptVault('')).toThrow(/Invalid vault token/);
    expect(() => decryptVault('not.a.valid.token')).toThrow(/Unsupported or malformed vault token format/);
    expect(() => decryptVault('v2.a.b.c')).toThrow(/Unsupported or malformed vault token format/);
  });
});
