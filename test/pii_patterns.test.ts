import { describe, it, expect } from 'vitest';
import {
  isValidLuhn,
  isValidIban,
  isValidCnp,
  isValidSsn,
  detectPiiEntities,
} from '../nodes/Guardrails/utils/pii_patterns';

describe('PII Pattern Detection and Checksums', () => {
  describe('Luhn Algorithm (Credit Cards)', () => {
    it('validates authentic credit card numbers', () => {
      // Standard Luhn test numbers (Visa, Mastercard, hyphenated)
      expect(isValidLuhn('4532 0151 1283 0366')).toBe(true);
      expect(isValidLuhn('5424 1801 2345 6789')).toBe(true);
      expect(isValidLuhn('4532-0151-1283-0366')).toBe(true);
    });

    it('rejects invalid card numbers with bad check digits', () => {
      expect(isValidLuhn('4532 0151 1283 0367')).toBe(false);
      expect(isValidLuhn('1234567812345671')).toBe(false);
      expect(isValidLuhn('123')).toBe(false);
    });
  });

  describe('IBAN Validation (Modulo 97)', () => {
    it('validates genuine international bank account numbers', () => {
      // Valid German, French, British, Romanian IBANs
      expect(isValidIban('DE89370400440532013000')).toBe(true);
      expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
      expect(isValidIban('GB82WEST12345698765432')).toBe(true);
      expect(isValidIban('RO49AAAA1B31007593840000')).toBe(true);
    });

    it('rejects invalid IBANs', () => {
      expect(isValidIban('DE89370400440532013001')).toBe(false);
      expect(isValidIban('NOTANIBAN')).toBe(false);
    });
  });

  describe('National IDs (US SSN and Romanian CNP)', () => {
    it('validates US SSN rules', () => {
      expect(isValidSsn('123-45-6789')).toBe(true);
      expect(isValidSsn('000-45-6789')).toBe(false); // Area 000 invalid
      expect(isValidSsn('666-45-6789')).toBe(false); // Area 666 invalid
      expect(isValidSsn('923-45-6789')).toBe(false); // Area 900+ invalid
      expect(isValidSsn('123-00-6789')).toBe(false); // Group 00 invalid
      expect(isValidSsn('123-45-0000')).toBe(false); // Serial 0000 invalid
    });

    it('validates Romanian CNP with control key', () => {
      // 1800101010015 has sum 82, rem 5 => control digit 5
      expect(isValidCnp('1800101010015')).toBe(true);
      expect(isValidCnp('1800101010014')).toBe(false);
      expect(isValidCnp('123')).toBe(false);
    });
  });

  describe('Comprehensive Entity Detection', () => {
    it('detects multiple entities without overlap', () => {
      const text =
        'Contact Alice at alice@company.org or +1 (555) 234-5678. ' +
        'Send funds to DE89370400440532013000 or card 4532-0151-1283-0366. ' +
        'Server is 192.168.1.50 and key is sk-proj-123456789012345678901234.';

      const entities = detectPiiEntities(text);
      expect(entities.length).toBeGreaterThanOrEqual(5);

      const types = entities.map((e) => e.type);
      expect(types).toContain('EMAIL');
      expect(types).toContain('PHONE');
      expect(types).toContain('IBAN');
      expect(types).toContain('CREDIT_CARD');
      expect(types).toContain('IPV4');
      expect(types).toContain('API_KEY');
    });

    it('supports custom user-defined regex patterns', () => {
      const text = 'Customer reference ID is CUST-98745 and order is ORD-1234.';
      const entities = detectPiiEntities(text, {
        customPatterns: [
          { name: 'CUSTOMER_ID', regex: 'CUST-\\d{5}' },
          { name: 'ORDER_NUM', regex: 'ORD-\\d{4}' },
        ],
      });

      expect(entities.length).toBe(2);
      expect(entities[0].customLabel).toBe('CUSTOMER_ID');
      expect(entities[0].original).toBe('CUST-98745');
      expect(entities[1].customLabel).toBe('ORDER_NUM');
      expect(entities[1].original).toBe('ORD-1234');
    });
  });
});
