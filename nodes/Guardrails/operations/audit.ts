import {
  detectPiiEntities,
  DetectedEntity,
  DetectionOptions,
  PiiEntityType,
} from '../utils/pii_patterns';

export interface AuditOptions extends DetectionOptions {
  includeOffsets?: boolean;
}

export interface PiiAuditReport {
  totalEntities: number;
  breakdown: Record<string, number>;
  gdprRiskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  pciDssImpact: boolean;
  hasCredentials: boolean;
  entities: Array<{
    type: PiiEntityType;
    preview: string;
    startIndex?: number;
    endIndex?: number;
    confidence: number;
    customLabel?: string;
  }>;
  scannedAt: string;
}

/**
 * Creates a safe masked preview for compliance log output.
 */
function createSafePreview(original: string, type: PiiEntityType): string {
  if (type === 'CREDIT_CARD' || type === 'IBAN') {
    return original.length > 8 ? `${original.slice(0, 4)}...${original.slice(-4)}` : '****';
  }
  if (type === 'EMAIL') {
    const parts = original.split('@');
    return parts.length === 2 ? `${parts[0].slice(0, 2)}***@${parts[1]}` : '***@***';
  }
  if (type === 'SECRET' || type === 'API_KEY') {
    return original.length > 10 ? `${original.slice(0, 6)}...` : '***';
  }
  return original.length > 4 ? `${original.slice(0, 2)}***${original.slice(-2)}` : '****';
}

/**
 * Recursively extracts strings from text or JSON data.
 */
function extractStrings(input: unknown): string[] {
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input.flatMap(extractStrings);
  if (input !== null && typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).flatMap(extractStrings);
  }
  return [];
}

/**
 * Generates a comprehensive PII audit and compliance assessment without modifying the payload.
 */
export function auditPii(input: unknown, options: AuditOptions = {}): PiiAuditReport {
  const strings = extractStrings(input);
  const allDetected: DetectedEntity[] = [];

  for (const str of strings) {
    const detected = detectPiiEntities(str, options);
    allDetected.push(...detected);
  }

  const breakdown: Record<string, number> = {};
  let pciDssImpact = false;
  let hasCredentials = false;

  for (const entity of allDetected) {
    const label = entity.customLabel || entity.type;
    breakdown[label] = (breakdown[label] || 0) + 1;

    if (entity.type === 'CREDIT_CARD') {
      pciDssImpact = true;
    }
    if (entity.type === 'API_KEY' || entity.type === 'SECRET') {
      hasCredentials = true;
    }
  }

  let gdprRiskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  if (allDetected.length > 0) {
    if (hasCredentials || pciDssImpact || allDetected.length > 5) {
      gdprRiskLevel = 'HIGH';
    } else if (allDetected.length > 2) {
      gdprRiskLevel = 'MEDIUM';
    } else {
      gdprRiskLevel = 'LOW';
    }
  }

  const entities = allDetected.map((e) => ({
    type: e.type,
    preview: createSafePreview(e.original, e.type),
    startIndex: options.includeOffsets ? e.startIndex : undefined,
    endIndex: options.includeOffsets ? e.endIndex : undefined,
    confidence: e.confidence,
    customLabel: e.customLabel,
  }));

  return {
    totalEntities: allDetected.length,
    breakdown,
    gdprRiskLevel,
    pciDssImpact,
    hasCredentials,
    entities,
    scannedAt: new Date().toISOString(),
  };
}
