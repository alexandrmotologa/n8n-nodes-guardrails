import {
  INJECTION_RULES,
  normalizeText,
  checkBase64Injection,
  AttackCategory,
} from '../utils/injection_patterns';

export type InjectionSensitivity = 'low' | 'medium' | 'high';

export interface InjectionCheckOptions {
  sensitivity?: InjectionSensitivity;
}

export interface MatchedRuleInfo {
  id: string;
  category: AttackCategory;
  description: string;
  weight: number;
}

export interface InjectionCheckResult {
  isUnsafe: boolean;
  riskScore: number;
  category?: AttackCategory;
  reason?: string;
  matchedRules: MatchedRuleInfo[];
  normalizedSample?: string;
}

const THRESHOLD_MAP: Record<InjectionSensitivity, number> = {
  low: 0.8,
  medium: 0.5,
  high: 0.3,
};

/**
 * Extracts all strings from text or structured JSON.
 */
function extractAllStrings(input: unknown): string[] {
  if (typeof input === 'string') {
    return [input];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => extractAllStrings(item));
  }
  if (input !== null && typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).flatMap((val) => extractAllStrings(val));
  }
  return [];
}

/**
 * Evaluates input for prompt injection, jailbreaks, and adversarial exploits.
 */
export function checkInjection(
  input: string | Record<string, unknown> | unknown[],
  options: InjectionCheckOptions = {},
): InjectionCheckResult {
  const sensitivity = options.sensitivity || 'medium';
  const threshold = THRESHOLD_MAP[sensitivity] || 0.5;

  const stringsToCheck = extractAllStrings(input);
  const matchedRules: MatchedRuleInfo[] = [];
  let highestWeight = 0;
  let primaryCategory: AttackCategory | undefined;

  for (const text of stringsToCheck) {
    if (!text || typeof text !== 'string') continue;

    // 1. Check for encoded base64 attack payloads
    const b64Check = checkBase64Injection(text);
    if (b64Check.isDetected) {
      matchedRules.push({
        id: 'ENCODED_BASE64_PAYLOAD',
        category: 'ENCODED_PAYLOAD',
        description: 'Obfuscated base64 payload containing injection instructions',
        weight: 0.95,
      });
      highestWeight = Math.max(highestWeight, 0.95);
      if (!primaryCategory) primaryCategory = 'ENCODED_PAYLOAD';
    }

    // 2. Check raw text against heuristic rules
    for (const rule of INJECTION_RULES) {
      if (rule.pattern.test(text)) {
        if (!matchedRules.some((m) => m.id === rule.id)) {
          matchedRules.push({
            id: rule.id,
            category: rule.category,
            description: rule.description,
            weight: rule.weight,
          });
          if (rule.weight > highestWeight) {
            highestWeight = rule.weight;
            primaryCategory = rule.category;
          }
        }
      }
    }

    // 3. Check normalized text (catches leetspeak and zero-width spaces)
    const normalized = normalizeText(text);
    for (const rule of INJECTION_RULES) {
      if (rule.pattern.test(normalized)) {
        if (!matchedRules.some((m) => m.id === rule.id)) {
          matchedRules.push({
            id: rule.id,
            category: rule.category,
            description: rule.description,
            weight: rule.weight,
          });
          if (rule.weight > highestWeight) {
            highestWeight = rule.weight;
            primaryCategory = rule.category;
          }
        }
      }
    }
  }

  // Calculate cumulative risk score
  const extraMatchesBonus = Math.max(0, matchedRules.length - 1) * 0.05;
  const riskScore = Math.min(1.0, parseFloat((highestWeight + extraMatchesBonus).toFixed(2)));
  const isUnsafe = riskScore >= threshold;

  let reason: string | undefined;
  if (isUnsafe && matchedRules.length > 0) {
    reason = `Detected ${matchedRules.length} injection signature(s) [${primaryCategory}]: ${matchedRules.map((m) => m.description).join(', ')}`;
  }

  return {
    isUnsafe,
    riskScore,
    category: primaryCategory,
    reason,
    matchedRules,
  };
}
