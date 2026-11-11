import * as crypto from 'node:crypto';
import {
  detectPiiEntities,
  DetectedEntity,
  DetectionOptions,
  PiiEntityType,
} from '../utils/pii_patterns';
import { encryptVault, VaultEntity, VaultPayload } from '../utils/crypto';

export type MaskingStrategy = 'tokens' | 'redaction' | 'partial' | 'hash';

export interface SanitizeOptions extends DetectionOptions {
  strategy?: MaskingStrategy;
  vaultSecret?: string;
  hashSalt?: string;
}

export interface SanitizeResult {
  sanitizedText?: string;
  sanitizedJson?: unknown;
  piiVault: string;
  detectedPiiCount: number;
  entities: DetectedEntity[];
}

/**
 * Creates a partial mask preserving context for human readability.
 */
function createPartialMask(original: string, type: PiiEntityType): string {
  if (type === 'EMAIL') {
    const parts = original.split('@');
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      const visible = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
      return `${visible}@${domain}`;
    }
  }

  if (type === 'CREDIT_CARD') {
    const digits = original.replace(/[\s-]/g, '');
    const lastFour = digits.slice(-4);
    return `****-****-****-${lastFour}`;
  }

  if (type === 'PHONE') {
    const digits = original.replace(/\D/g, '');
    const lastFour = digits.slice(-4);
    return `***-***-${lastFour}`;
  }

  if (original.length <= 4) {
    return '****';
  }

  return `${original.slice(0, 2)}***${original.slice(-2)}`;
}

/**
 * Creates a salted SHA-256 hash token.
 */
function createHashMask(original: string, salt: string): string {
  const hash = crypto.createHash('sha256').update(original + salt).digest('hex').substring(0, 16);
  return `[HASH:${hash}]`;
}

/**
 * Masks a single string, collecting entity mappings.
 */
export function maskString(
  text: string,
  options: SanitizeOptions,
  counterMap: Map<string, number>,
  vaultEntities: VaultEntity[],
  globalMapping: Record<string, string>,
): { masked: string; detected: DetectedEntity[] } {
  if (!text || typeof text !== 'string') {
    return { masked: text, detected: [] };
  }

  const detected = detectPiiEntities(text, options);
  if (detected.length === 0) {
    return { masked: text, detected: [] };
  }

  const strategy = options.strategy || 'tokens';
  const salt = options.hashSalt || 'guardrails-salt';

  let result = '';
  let cursor = 0;

  for (const entity of detected) {
    result += text.substring(cursor, entity.startIndex);

    let replacement = '';
    const label = entity.customLabel || entity.type;

    if (strategy === 'tokens') {
      const currentCount = (counterMap.get(label) || 0) + 1;
      counterMap.set(label, currentCount);
      const token = `{{${label}_${currentCount}}}`;
      replacement = token;

      globalMapping[token] = entity.original;
      vaultEntities.push({
        token,
        type: entity.type,
        original: entity.original,
        maskedAt: new Date().toISOString(),
      });
    } else if (strategy === 'redaction') {
      replacement = `[REDACTED_${label}]`;
    } else if (strategy === 'partial') {
      replacement = createPartialMask(entity.original, entity.type);
    } else if (strategy === 'hash') {
      replacement = createHashMask(entity.original, salt);
    }

    result += replacement;
    cursor = entity.endIndex;
  }

  result += text.substring(cursor);
  return { masked: result, detected };
}

/**
 * Recursively traverses a JSON structure, masking all string values.
 */
function traverseAndMaskJson(
  data: unknown,
  options: SanitizeOptions,
  counterMap: Map<string, number>,
  vaultEntities: VaultEntity[],
  globalMapping: Record<string, string>,
  allDetected: DetectedEntity[],
): unknown {
  if (typeof data === 'string') {
    const { masked, detected } = maskString(data, options, counterMap, vaultEntities, globalMapping);
    allDetected.push(...detected);
    return masked;
  }

  if (Array.isArray(data)) {
    return data.map((item) =>
      traverseAndMaskJson(item, options, counterMap, vaultEntities, globalMapping, allDetected),
    );
  }

  if (data !== null && typeof data === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      newObj[key] = traverseAndMaskJson(
        value,
        options,
        counterMap,
        vaultEntities,
        globalMapping,
        allDetected,
      );
    }
    return newObj;
  }

  return data;
}

/**
 * Main sanitize function supporting either a raw string or structured JSON.
 */
export function sanitize(
  input: string | Record<string, unknown> | unknown[],
  options: SanitizeOptions = {},
): SanitizeResult {
  const counterMap = new Map<string, number>();
  const vaultEntities: VaultEntity[] = [];
  const globalMapping: Record<string, string> = {};
  const allDetected: DetectedEntity[] = [];

  let sanitizedText: string | undefined;
  let sanitizedJson: unknown | undefined;

  if (typeof input === 'string') {
    const { masked, detected } = maskString(input, options, counterMap, vaultEntities, globalMapping);
    sanitizedText = masked;
    allDetected.push(...detected);
  } else {
    sanitizedJson = traverseAndMaskJson(
      input,
      options,
      counterMap,
      vaultEntities,
      globalMapping,
      allDetected,
    );
  }

  const vaultPayload: VaultPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    mapping: globalMapping,
    entities: vaultEntities,
  };

  const piiVault = encryptVault(vaultPayload, options.vaultSecret);

  return {
    sanitizedText,
    sanitizedJson,
    piiVault,
    detectedPiiCount: allDetected.length,
    entities: allDetected,
  };
}
