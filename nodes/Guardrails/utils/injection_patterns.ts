export type AttackCategory =
  | 'DIRECT_OVERRIDE'
  | 'SYSTEM_PROMPT_EXTRACTION'
  | 'JAILBREAK_PERSONA'
  | 'DELIMITER_BREAKOUT'
  | 'ENCODED_PAYLOAD'
  | 'ROLEPLAY_BYPASS'
  | 'DATA_EXFILTRATION'
  | 'MULTILINGUAL_OVERRIDE';

export interface InjectionRule {
  id: string;
  category: AttackCategory;
  pattern: RegExp;
  weight: number;
  description: string;
}

export const INJECTION_RULES: InjectionRule[] = [
  // 1. Direct Instruction Overrides
  {
    id: 'OVERRIDE_IGNORE_PREVIOUS',
    category: 'DIRECT_OVERRIDE',
    pattern: /\b(?:ignore|disregard|forget|override|neglect|bypass)\s+(?:all\s+)?(?:previous|prior|above|former|initial|system)\s+(?:instructions|prompts|rules|guidelines|directives|constraints)\b/i,
    weight: 0.95,
    description: 'Direct override asking to ignore previous instructions',
  },
  {
    id: 'OVERRIDE_NEW_INSTRUCTIONS',
    category: 'DIRECT_OVERRIDE',
    pattern: /\b(?:your\s+new\s+instructions\s+are|from\s+now\s+on\s+you\s+must\s+obey|new\s+system\s+directive)\b/i,
    weight: 0.85,
    description: 'Attempt to inject new governing instructions',
  },

  // 2. System Prompt Extraction
  {
    id: 'EXTRACT_SYSTEM_PROMPT',
    category: 'SYSTEM_PROMPT_EXTRACTION',
    pattern: /\b(?:repeat|print|output|display|show|reveal|leak|expose|echo)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|system\s+instructions|instructions\s+above|verbatim\s+rules|developer\s+message)\b/i,
    weight: 0.9,
    description: 'Attempt to extract or dump system prompt',
  },
  {
    id: 'EXTRACT_WHAT_IS_ABOVE',
    category: 'SYSTEM_PROMPT_EXTRACTION',
    pattern: /\b(?:what\s+(?:are|were)\s+the\s+(?:exact\s+)?words\s+(?:written|given)\s+above|what\s+is\s+your\s+system\s+prompt)\b/i,
    weight: 0.85,
    description: 'Inquiry attempting to extract upper prompt context',
  },

  // 3. Jailbreak Personas & Modes
  {
    id: 'JAILBREAK_DAN',
    category: 'JAILBREAK_PERSONA',
    pattern: /\b(?:dan\s+mode|do\s+anything\s+now|jailbreak\s+mode|aim\s+mode|chaosgpt|unrestricted\s+mode)\b/i,
    weight: 0.95,
    description: 'Known jailbreak persona signature (DAN, ChaosGPT, etc.)',
  },
  {
    id: 'JAILBREAK_DEVELOPER_MODE',
    category: 'JAILBREAK_PERSONA',
    pattern: /\b(?:you\s+are\s+now\s+in\s+developer\s+mode|developer\s+mode\s+enabled|unfiltered\s+mode)\b/i,
    weight: 0.9,
    description: 'Developer mode toggle attempt',
  },

  // 4. Roleplay & Fictional Rule Suspension
  {
    id: 'ROLEPLAY_UNFILTERED',
    category: 'ROLEPLAY_BYPASS',
    pattern: /\b(?:pretend\s+(?:that\s+)?you\s+(?:have\s+no|do\s+not\s+have\s+any)\s+(?:filters|safety|rules|restrictions|ethics)|act\s+as\s+an\s+unfiltered\s+ai)\b/i,
    weight: 0.9,
    description: 'Roleplay instruction commanding removal of safety filters',
  },
  {
    id: 'ROLEPLAY_HYPOTHETICAL_NO_RULES',
    category: 'ROLEPLAY_BYPASS',
    pattern: /\b(?:hypothetical\s+scenario\s+where\s+(?:laws|rules|guidelines)\s+(?:do\s+not\s+apply|are\s+suspended)|in\s+this\s+fictional\s+world\s+ethics\s+dont\s+exist)\b/i,
    weight: 0.8,
    description: 'Hypothetical framing to evade ethical rules',
  },

  // 5. Delimiter & Prompt Framing Breakouts
  {
    id: 'DELIMITER_SYSTEM_TAGS',
    category: 'DELIMITER_BREAKOUT',
    pattern: /<\/?(?:system|instruction|prompt|context|human|assistant|user)>|<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]/i,
    weight: 0.95,
    description: 'Chat markup delimiter injection attempt',
  },
  {
    id: 'DELIMITER_MARKDOWN_COMMENT',
    category: 'DELIMITER_BREAKOUT',
    pattern: /\[\/\/\s*\]:\s*#\s*\((?:ignore|system|instruction)[^)]*\)/i,
    weight: 0.85,
    description: 'Markdown comment payload injection',
  },
  {
    id: 'DELIMITER_SYSTEM_HEADER',
    category: 'DELIMITER_BREAKOUT',
    pattern: /(?:^|\n)#{1,4}\s*(?:System|Instruction|Assistant|Human):\s*/i,
    weight: 0.75,
    description: 'Markdown header delimiter imitating system frame',
  },

  // 6. Data Exfiltration Patterns
  {
    id: 'EXFIL_MARKDOWN_IMAGE',
    category: 'DATA_EXFILTRATION',
    pattern: /!\[.*?\]\((?:https?:)?\/\/[^\s)]+[?&](?:token|data|secret|pii|vault|leak|exfil|key)=[^)]*\)/i,
    weight: 0.95,
    description: 'Markdown image injection attempting side-channel data exfiltration',
  },
  {
    id: 'EXFIL_RENDER_IMAGE_COMMAND',
    category: 'DATA_EXFILTRATION',
    pattern: /\b(?:render|display|output|show)\s+(?:an?\s+)?(?:markdown\s+)?image\s+(?:with|containing)\s+(?:the\s+)?(?:secret|key|vault|password|prompt|token)\b/i,
    weight: 0.9,
    description: 'Directive forcing the model to generate image tags for data exfiltration',
  },

  // 7. Multilingual Injection Overrides
  {
    id: 'MULTILINGUAL_RO_OVERRIDE',
    category: 'MULTILINGUAL_OVERRIDE',
    pattern: /\b(?:ignora|ignoreaza|uita)\s+(?:toate\s+)?(?:instructiunile|regulile)\s+(?:anterioare|precedente)\b/i,
    weight: 0.95,
    description: 'Romanian instruction override (ignora instructiunile anterioare)',
  },
  {
    id: 'MULTILINGUAL_ES_OVERRIDE',
    category: 'MULTILINGUAL_OVERRIDE',
    pattern: /\b(?:ignora|olvida)\s+(?:todas\s+)?(?:las\s+)?(?:instrucciones|reglas)\s+(?:anteriores|previas)\b/i,
    weight: 0.95,
    description: 'Spanish instruction override (ignora las instrucciones anteriores)',
  },
  {
    id: 'MULTILINGUAL_FR_OVERRIDE',
    category: 'MULTILINGUAL_OVERRIDE',
    pattern: /\b(?:ignore|oublie)\s+(?:toutes\s+)?(?:les\s+)?(?:instructions|directives)\s+(?:pr[eé]c[eé]dentes|ant[eé]rieures)\b/i,
    weight: 0.95,
    description: 'French instruction override (ignore les instructions precedentes)',
  },
  {
    id: 'MULTILINGUAL_DE_OVERRIDE',
    category: 'MULTILINGUAL_OVERRIDE',
    pattern: /\b(?:ignoriere|vergiss)\s+(?:alle\s+)?(?:vorherigen\s+)?(?:anweisungen|regeln)\b/i,
    weight: 0.95,
    description: 'German instruction override (ignoriere vorherige anweisungen)',
  },
];

/**
 * Normalizes text to defeat simple evasion tricks (zero-width spaces, leetspeak, unicode homoglyphs).
 */
export function normalizeText(raw: string): string {
  if (!raw) return '';

  // 1. Unicode NFKC normalization
  let clean = raw.normalize('NFKC');

  // 2. Remove zero-width characters and invisible control codepoints
  clean = clean.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u00A0]/g, ' ');

  // 3. Normalize common leetspeak substitutions
  clean = clean
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$]/g, 's')
    .replace(/[5]/g, 's')
    .replace(/[7]/g, 't');

  // 4. Collapse consecutive whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Checks for base64 encoded text containing injection strings.
 */
export function checkBase64Injection(text: string): { isDetected: boolean; decodedPayload?: string } {
  // Matches base64 candidate strings of at least 24 characters
  const b64Regex = /\b[A-Za-z0-9+/]{24,}={0,2}\b/g;
  let match: RegExpExecArray | null;

  while ((match = b64Regex.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(match[0], 'base64').toString('utf8');
      // If decoded contains common injection keywords
      if (
        /ignore\s+previous|system\s+prompt|developer\s+mode|dan\s+mode/i.test(decoded)
      ) {
        return { isDetected: true, decodedPayload: decoded };
      }
    } catch {
      // Not valid base64 utf8, continue
    }
  }

  return { isDetected: false };
}
