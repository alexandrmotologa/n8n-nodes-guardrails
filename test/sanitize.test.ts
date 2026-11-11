import { describe, it, expect } from 'vitest';
import { sanitize } from '../nodes/Guardrails/operations/sanitize';

describe('Sanitize Operation', () => {
  it('masks sensitive text with synthetic tokens', () => {
    const input = 'My email is bob@example.com and my card is 4532 0151 1283 0366.';
    const result = sanitize(input, { strategy: 'tokens' });

    expect(result.detectedPiiCount).toBe(2);
    expect(result.sanitizedText).toContain('{{EMAIL_1}}');
    expect(result.sanitizedText).toContain('{{CREDIT_CARD_1}}');
    expect(result.sanitizedText).not.toContain('bob@example.com');
    expect(result.sanitizedText).not.toContain('4532 0151 1283 0366');
    expect(result.piiVault).toBeDefined();
  });

  it('masks with permanent redaction strategy', () => {
    const input = 'Contact bob@example.com immediately.';
    const result = sanitize(input, { strategy: 'redaction' });

    expect(result.sanitizedText).toBe('Contact [REDACTED_EMAIL] immediately.');
  });

  it('masks with partial context strategy', () => {
    const input = 'Card 4532-0151-1283-0366 and email johnny@example.com.';
    const result = sanitize(input, { strategy: 'partial' });

    expect(result.sanitizedText).toContain('****-****-****-0366');
    expect(result.sanitizedText).toContain('j***y@example.com');
  });

  it('masks with salted hash strategy', () => {
    const input = 'Email bob@example.com';
    const result = sanitize(input, { strategy: 'hash', hashSalt: 'test-salt' });

    expect(result.sanitizedText).toMatch(/Email \[HASH:[a-f0-9]{16}\]/);
  });

  it('deep scans and masks nested JSON objects and arrays', () => {
    const inputJson = {
      user: {
        name: 'John Doe',
        contact: {
          email: 'john@enterprise.com',
          phone: '+1 (555) 345-6789',
        },
      },
      payment: {
        cards: ['4532 0151 1283 0366'],
        iban: 'DE89370400440532013000',
      },
      notes: ['Urgent message to john@enterprise.com'],
    };

    const result = sanitize(inputJson, { strategy: 'tokens' });
    expect(result.detectedPiiCount).toBe(5);

    const json = result.sanitizedJson as typeof inputJson;
    expect(json.user.contact.email).toBe('{{EMAIL_1}}');
    expect(json.user.contact.phone).toBe('{{PHONE_1}}');
    expect(json.payment.cards[0]).toBe('{{CREDIT_CARD_1}}');
    expect(json.payment.iban).toBe('{{IBAN_1}}');
    expect(json.notes[0]).toBe('Urgent message to {{EMAIL_2}}');
  });

  it('respects selective detector disabling', () => {
    const input = 'Email bob@example.com and IP 192.168.1.1';
    const result = sanitize(input, {
      detectEmail: false,
      detectIpAddress: true,
    });

    expect(result.detectedPiiCount).toBe(1);
    expect(result.sanitizedText).toContain('bob@example.com');
    expect(result.sanitizedText).toContain('{{IPV4_1}}');
  });
});
