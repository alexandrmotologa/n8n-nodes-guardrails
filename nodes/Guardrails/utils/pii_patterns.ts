export type PiiEntityType =
  | 'CREDIT_CARD'
  | 'IBAN'
  | 'EMAIL'
  | 'PHONE'
  | 'US_SSN'
  | 'RO_CNP'
  | 'IPV4'
  | 'IPV6'
  | 'API_KEY'
  | 'SECRET'
  | 'CUSTOM';

export interface DetectedEntity {
  type: PiiEntityType;
  original: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  customLabel?: string;
}

export interface CustomPattern {
  name: string;
  regex: string;
}

/**
 * Validates a credit card number using the Luhn checksum algorithm (Mod 10).
 */
export function isValidLuhn(input: string): boolean {
  const sanitized = input.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(sanitized)) {
    return false;
  }

  let sum = 0;
  let alternate = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let n = parseInt(sanitized.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Validates an International Bank Account Number (IBAN) using ISO 7064 Modulo 97.
 */
export function isValidIban(input: string): boolean {
  const sanitized = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(sanitized)) {
    return false;
  }

  // Move first 4 characters to the end
  const rearranged = sanitized.slice(4) + sanitized.slice(0, 4);

  // Convert letters to numbers: A = 10, B = 11, ..., Z = 35
  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numericString += (code - 55).toString();
    } else {
      numericString += rearranged.charAt(i);
    }
  }

  // Compute modulo 97 in chunks to avoid floating point overflow
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = remainder.toString() + numericString.substring(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }

  return remainder === 1;
}

/**
 * Validates Romanian CNP (Cod Numeric Personal) using its 12-digit control key.
 */
export function isValidCnp(cnp: string): boolean {
  if (!/^[1-8]\d{12}$/.test(cnp)) {
    return false;
  }

  const controlKey = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnp.charAt(i), 10) * controlKey[i];
  }

  const remainder = sum % 11;
  const controlDigit = remainder === 10 ? 1 : remainder;

  return controlDigit === parseInt(cnp.charAt(12), 10);
}

/**
 * Validates US Social Security Number formatting rules.
 */
export function isValidSsn(ssn: string): boolean {
  const clean = ssn.replace(/[-\s]/g, '');
  if (!/^\d{9}$/.test(clean)) {
    return false;
  }

  const area = clean.substring(0, 3);
  const group = clean.substring(3, 5);
  const serial = clean.substring(5, 9);

  if (area === '000' || area === '666' || parseInt(area, 10) >= 900) {
    return false;
  }
  if (group === '00') {
    return false;
  }
  if (serial === '0000') {
    return false;
  }

  return true;
}

// Regex definitions
const REGEX_EMAIL = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const REGEX_PHONE = /(?:\b|\+)(?:\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;
const REGEX_CARD_CANDIDATE = /\b(?:\d[ -]*?){13,19}\b/g;
const REGEX_IBAN_CANDIDATE = /\b[A-Za-z]{2}\d{2}(?:[A-Za-z0-9]{11,30}|(?: [A-Za-z0-9]{4}){2,7}(?: [A-Za-z0-9]{1,4})?)\b/g;
const REGEX_US_SSN_CANDIDATE = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g;
const REGEX_RO_CNP_CANDIDATE = /\b[1-8]\d{12}\b/g;
const REGEX_IPV4 = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const REGEX_IPV6 = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:[0-9a-fA-F]{1,4}\b|\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g;
const REGEX_OPENAI_KEY = /\bsk-(?:proj-|admin-)?[a-zA-Z0-9_-]{20,}\b/g;
const REGEX_AWS_KEY = /\bAKIA[0-9A-Z]{16}\b/g;
const REGEX_GITHUB_TOKEN = /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/g;
const REGEX_BEARER = /\bBearer\s+[a-zA-Z0-9_\-\.]{25,}\b/g;
const REGEX_PRIVATE_KEY = /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+ PRIVATE KEY-----/g;

export interface DetectionOptions {
  detectCreditCards?: boolean;
  detectIban?: boolean;
  detectEmail?: boolean;
  detectPhone?: boolean;
  detectNationalId?: boolean;
  detectIpAddress?: boolean;
  detectSecrets?: boolean;
  customPatterns?: CustomPattern[];
}

/**
 * Finds all sensitive entities within a given string, validating checksums where applicable.
 */
export function detectPiiEntities(text: string, options: DetectionOptions = {}): DetectedEntity[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const {
    detectCreditCards = true,
    detectIban = true,
    detectEmail = true,
    detectPhone = true,
    detectNationalId = true,
    detectIpAddress = true,
    detectSecrets = true,
    customPatterns = [],
  } = options;

  const rawEntities: DetectedEntity[] = [];

  // 1. Private Keys (high priority block)
  if (detectSecrets) {
    let match: RegExpExecArray | null;
    const keyRegex = new RegExp(REGEX_PRIVATE_KEY.source, 'g');
    while ((match = keyRegex.exec(text)) !== null) {
      rawEntities.push({
        type: 'SECRET',
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 1.0,
      });
    }
  }

  // 2. Credit Cards with Luhn Check
  if (detectCreditCards) {
    let match: RegExpExecArray | null;
    const cardRegex = new RegExp(REGEX_CARD_CANDIDATE.source, 'g');
    while ((match = cardRegex.exec(text)) !== null) {
      const candidate = match[0].trim();
      const digitsOnly = candidate.replace(/[\s-]/g, '');
      if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && isValidLuhn(digitsOnly)) {
        rawEntities.push({
          type: 'CREDIT_CARD',
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.98,
        });
      }
    }
  }

  // 3. IBAN with Mod 97 Check
  if (detectIban) {
    let match: RegExpExecArray | null;
    const ibanRegex = new RegExp(REGEX_IBAN_CANDIDATE.source, 'g');
    while ((match = ibanRegex.exec(text)) !== null) {
      const candidate = match[0].trim();
      if (isValidIban(candidate)) {
        rawEntities.push({
          type: 'IBAN',
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.99,
        });
      }
    }
  }

  // 4. Email Addresses
  if (detectEmail) {
    let match: RegExpExecArray | null;
    const emailRegex = new RegExp(REGEX_EMAIL.source, 'g');
    while ((match = emailRegex.exec(text)) !== null) {
      rawEntities.push({
        type: 'EMAIL',
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.99,
      });
    }
  }

  // 5. National IDs (US SSN and RO CNP)
  if (detectNationalId) {
    let match: RegExpExecArray | null;
    const ssnRegex = new RegExp(REGEX_US_SSN_CANDIDATE.source, 'g');
    while ((match = ssnRegex.exec(text)) !== null) {
      if (isValidSsn(match[0])) {
        rawEntities.push({
          type: 'US_SSN',
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.95,
        });
      }
    }

    const cnpRegex = new RegExp(REGEX_RO_CNP_CANDIDATE.source, 'g');
    while ((match = cnpRegex.exec(text)) !== null) {
      if (isValidCnp(match[0])) {
        rawEntities.push({
          type: 'RO_CNP',
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.99,
        });
      }
    }
  }

  // 6. IP Addresses
  if (detectIpAddress) {
    let match: RegExpExecArray | null;
    const ipv4Regex = new RegExp(REGEX_IPV4.source, 'g');
    while ((match = ipv4Regex.exec(text)) !== null) {
      rawEntities.push({
        type: 'IPV4',
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95,
      });
    }

    const ipv6Regex = new RegExp(REGEX_IPV6.source, 'g');
    while ((match = ipv6Regex.exec(text)) !== null) {
      rawEntities.push({
        type: 'IPV6',
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95,
      });
    }
  }

  // 7. API Keys and Tokens
  if (detectSecrets) {
    const secretRegexes: Array<{ regex: RegExp; type: PiiEntityType }> = [
      { regex: new RegExp(REGEX_OPENAI_KEY.source, 'g'), type: 'API_KEY' },
      { regex: new RegExp(REGEX_AWS_KEY.source, 'g'), type: 'API_KEY' },
      { regex: new RegExp(REGEX_GITHUB_TOKEN.source, 'g'), type: 'API_KEY' },
      { regex: new RegExp(REGEX_BEARER.source, 'g'), type: 'API_KEY' },
    ];

    for (const item of secretRegexes) {
      let match: RegExpExecArray | null;
      while ((match = item.regex.exec(text)) !== null) {
        rawEntities.push({
          type: item.type,
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.99,
        });
      }
    }
  }

  // 8. Phone Numbers (after cards and SSN to prevent partial phone collision)
  if (detectPhone) {
    let match: RegExpExecArray | null;
    const phoneRegex = new RegExp(REGEX_PHONE.source, 'g');
    while ((match = phoneRegex.exec(text)) !== null) {
      const candidate = match[0].trim();
      const digitCount = (candidate.match(/\d/g) || []).length;
      if (digitCount >= 7 && digitCount <= 15) {
        rawEntities.push({
          type: 'PHONE',
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.85,
        });
      }
    }
  }

  // 9. Custom User Patterns
  if (customPatterns && customPatterns.length > 0) {
    for (const custom of customPatterns) {
      try {
        const regex = new RegExp(custom.regex, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          rawEntities.push({
            type: 'CUSTOM',
            customLabel: custom.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
            original: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            confidence: 0.9,
          });
        }
      } catch {
        // Skip invalid regex gracefully
      }
    }
  }

  // Sort by start index ascending, longer matches first on overlap
  rawEntities.sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    return (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
  });

  // Filter overlapping entities (keep the earliest/longest one)
  const nonOverlapping: DetectedEntity[] = [];
  let lastEnd = -1;

  for (const entity of rawEntities) {
    if (entity.startIndex >= lastEnd) {
      nonOverlapping.push(entity);
      lastEnd = entity.endIndex;
    }
  }

  return nonOverlapping;
}
