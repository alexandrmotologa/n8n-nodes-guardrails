import { describe, it, expect } from 'vitest';
import { evaluateCircuitBreaker } from '../nodes/Guardrails/operations/circuit_breaker';
import { calculateTokenCostUsd } from '../nodes/Guardrails/utils/pricing_table';

describe('Spend and Loop Circuit Breaker', () => {
  describe('Token Cost Calculations', () => {
    it('accurately calculates token costs across models', () => {
      // 100k input, 50k output on GPT-4o ($2.50 / $10.00 per 1M)
      // Input: 0.1 * 2.50 = 0.25; Output: 0.05 * 10 = 0.50 => Total: 0.75
      const gptCost = calculateTokenCostUsd('gpt-4o', 100_000, 50_000);
      expect(gptCost).toBe(0.75);

      // Claude 3.5 Sonnet ($3.00 / $15.00 per 1M)
      // 10k input, 2k output
      // Input: 0.01 * 3 = 0.03; Output: 0.002 * 15 = 0.03 => Total: 0.06
      const claudeCost = calculateTokenCostUsd('claude-3-5-sonnet', 10_000, 2_000);
      expect(claudeCost).toBe(0.06);

      // Gemini 1.5 Flash ($0.075 / $0.30 per 1M)
      const geminiCost = calculateTokenCostUsd('gemini-1-5-flash', 100_000, 100_000);
      expect(geminiCost).toBe(0.0375);
    });

    it('calculates custom token rates', () => {
      // Custom: $1.00 in, $2.00 out per 1M
      const cost = calculateTokenCostUsd('custom', 1_000_000, 1_000_000, 1.0, 2.0);
      expect(cost).toBe(3.0);
    });
  });

  describe('Breaker Evaluations', () => {
    it('passes when cost and iterations are within configured limits', () => {
      const result = evaluateCircuitBreaker({
        model: 'gpt-4o-mini',
        promptTokens: 10_000,
        completionTokens: 2_000,
        iterationCount: 3,
        maxCostUsd: 0.1,
        maxIterations: 5,
      });

      expect(result.isBreached).toBe(false);
      expect(result.status).toBe('PASSED');
      expect(result.breachedReasons.length).toBe(0);
      expect(result.estimatedCostUsd).toBeLessThan(0.01);
    });

    it('trips when budget limit is exceeded', () => {
      const result = evaluateCircuitBreaker({
        model: 'gpt-4o',
        promptTokens: 100_000, // 0.25 USD
        completionTokens: 50_000, // 0.50 USD -> total 0.75 USD
        iterationCount: 1,
        maxCostUsd: 0.2, // limit is 0.20 USD
        maxIterations: 10,
      });

      expect(result.isBreached).toBe(true);
      expect(result.status).toBe('BREACHED');
      expect(result.breachedReasons[0]).toContain('Cost limit exceeded');
    });

    it('trips when iteration depth limit is exceeded', () => {
      const result = evaluateCircuitBreaker({
        model: 'gpt-4o-mini',
        promptTokens: 500,
        completionTokens: 200,
        iterationCount: 12, // current is 12
        maxCostUsd: 1.0,
        maxIterations: 10, // max is 10
      });

      expect(result.isBreached).toBe(true);
      expect(result.breachedReasons[0]).toContain('Iteration depth exceeded');
    });
  });
});
