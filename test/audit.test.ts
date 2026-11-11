import { describe, it, expect } from 'vitest';
import { auditPii } from '../nodes/Guardrails/operations/audit';

describe('PII Audit & Compliance Report', () => {
  it('analyzes text and calculates risk metrics without modifying payload', () => {
    const text = 'User john@example.com with credit card 4532 0151 1283 0366 and IP 192.168.1.1';
    const report = auditPii(text);

    expect(report.totalEntities).toBe(3);
    expect(report.breakdown['EMAIL']).toBe(1);
    expect(report.breakdown['CREDIT_CARD']).toBe(1);
    expect(report.breakdown['IPV4']).toBe(1);
    expect(report.pciDssImpact).toBe(true);
    expect(report.gdprRiskLevel).toBe('HIGH'); // credit card triggers high
    expect(report.entities[0].preview).toBe('jo***@example.com');
    expect(report.entities[1].preview).toBe('4532...0366');
  });

  it('audits nested JSON payloads', () => {
    const json = {
      customer: {
        email: 'alice@wonderland.org',
        phone: '+1 (555) 234-5678',
      },
      system: {
        serverIp: '10.0.0.5',
      },
    };

    const report = auditPii(json);
    expect(report.totalEntities).toBe(3);
    expect(report.pciDssImpact).toBe(false);
    expect(report.hasCredentials).toBe(false);
  });

  it('respects allowlist in audit mode', () => {
    const text = 'Internal engineer alex@company.com and customer client@external.com';
    const report = auditPii(text, { allowlist: ['@company.com'] });

    expect(report.totalEntities).toBe(1);
    expect(report.entities[0].preview).toBe('cl***@external.com');
  });
});
