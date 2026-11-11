export interface ModelPricing {
  displayName: string;
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': {
    displayName: 'GPT-4o',
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o Mini',
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  'gpt-4-turbo': {
    displayName: 'GPT-4 Turbo',
    inputPerMillion: 10.0,
    outputPerMillion: 30.0,
  },
  'o1': {
    displayName: 'OpenAI o1',
    inputPerMillion: 15.0,
    outputPerMillion: 60.0,
  },
  'o1-mini': {
    displayName: 'OpenAI o1-mini',
    inputPerMillion: 3.0,
    outputPerMillion: 12.0,
  },

  // Anthropic
  'claude-3-5-sonnet': {
    displayName: 'Claude 3.5 Sonnet',
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  'claude-3-5-haiku': {
    displayName: 'Claude 3.5 Haiku',
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
  },
  'claude-3-opus': {
    displayName: 'Claude 3 Opus',
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },

  // Google Gemini
  'gemini-1-5-pro': {
    displayName: 'Gemini 1.5 Pro',
    inputPerMillion: 1.25,
    outputPerMillion: 5.0,
  },
  'gemini-1-5-flash': {
    displayName: 'Gemini 1.5 Flash',
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
  },
  'gemini-2-0-flash': {
    displayName: 'Gemini 2.0 Flash',
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
  },
};

/**
 * Calculates estimated USD cost from prompt and completion token counts.
 */
export function calculateTokenCostUsd(
  modelKey: string,
  promptTokens: number,
  completionTokens: number,
  customInputRate?: number,
  customOutputRate?: number,
): number {
  let inRate = 0;
  let outRate = 0;

  if (modelKey === 'custom') {
    inRate = customInputRate || 0;
    outRate = customOutputRate || 0;
  } else {
    const pricing = MODEL_PRICING_TABLE[modelKey] || MODEL_PRICING_TABLE['gpt-4o'];
    inRate = pricing.inputPerMillion;
    outRate = pricing.outputPerMillion;
  }

  const promptCost = (promptTokens / 1_000_000) * inRate;
  const completionCost = (completionTokens / 1_000_000) * outRate;
  const total = promptCost + completionCost;

  // Round to 6 decimal places for high precision micro-costs
  return Math.round(total * 1_000_000) / 1_000_000;
}
