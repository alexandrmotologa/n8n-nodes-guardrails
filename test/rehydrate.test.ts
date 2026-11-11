import { describe, it, expect } from 'vitest';
import { sanitize } from '../nodes/Guardrails/operations/sanitize';
import { rehydrate } from '../nodes/Guardrails/operations/rehydrate';

describe('Rehydrate Operation', () => {
  it('restores masked tokens in text back to original values', () => {
    const raw = 'Send invoice to billing@acme.corp for account DE89370400440532013000.';
    const masked = sanitize(raw, { strategy: 'tokens' });

    // Simulate LLM response containing synthetic tokens
    const llmResponse = `Invoice confirmation has been queued for ${masked.sanitizedText}`;
    const restored = rehydrate(llmResponse, masked.piiVault);

    expect(restored.restoredCount).toBe(2);
    expect(restored.restoredText).toBe(
      'Invoice confirmation has been queued for Send invoice to billing@acme.corp for account DE89370400440532013000.',
    );
  });

  it('restores tokens in structured JSON responses', () => {
    const rawJson = {
      customer: 'john@example.com',
      card: '4532 0151 1283 0366',
    };
    const masked = sanitize(rawJson, { strategy: 'tokens' });

    const llmReplyJson = {
      status: 'SUCCESS',
      summary: 'Processed payment for {{EMAIL_1}} using card {{CREDIT_CARD_1}}',
      recipient: '{{EMAIL_1}}',
    };

    const restored = rehydrate(llmReplyJson, masked.piiVault);
    expect(restored.restoredCount).toBe(3);

    const outJson = restored.restoredJson as typeof llmReplyJson;
    expect(outJson.recipient).toBe('john@example.com');
    expect(outJson.summary).toBe('Processed payment for john@example.com using card 4532 0151 1283 0366');
  });

  it('throws an error if vault token is missing or corrupted', () => {
    expect(() => rehydrate('Some text', '')).toThrow(/Missing piiVault token/);
    expect(() => rehydrate('Some text', 'v1.invalid.token.data')).toThrow();
  });

  it('handles custom encryption secrets seamlessly', () => {
    const raw = 'Secret user alice@wonderland.org';
    const secret = 'custom-key-xyz';
    const masked = sanitize(raw, { vaultSecret: secret });

    // Fails without secret or with wrong secret
    expect(() => rehydrate(masked.sanitizedText!, masked.piiVault)).toThrow();

    // Succeeds with correct secret
    const restored = rehydrate(masked.sanitizedText!, masked.piiVault, { vaultSecret: secret });
    expect(restored.restoredText).toBe(raw);
  });
});
