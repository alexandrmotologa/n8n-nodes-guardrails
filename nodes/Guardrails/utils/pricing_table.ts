export interface ModelPricing {
  displayName: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': {
    displayName: 'GPT-4o',
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    cachedInputPerMillion: 1.25,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o Mini',
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
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
    cachedInputPerMillion: 7.5,
  },
  'o1-mini': {
    displayName: 'OpenAI o1-mini',
    inputPerMillion: 3.0,
    outputPerMillion: 12.0,
    cachedInputPerMillion: 1.5,
  },
  'o3-mini': {
    displayName: 'OpenAI o3-mini',
    inputPerMillion: 1.1,
    outputPerMillion: 4.4,
    cachedInputPerMillion: 0.55,
  },
  'gpt-4.5-preview': {
    displayName: 'GPT-4.5 Preview',
    inputPerMillion: 75.0,
    outputPerMillion: 150.0,
    cachedInputPerMillion: 37.5,
  },

  // Anthropic
  'claude-3-7-sonnet': {
    displayName: 'Claude 3.7 Sonnet (Hybrid)',
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedInputPerMillion: 0.3,
  },
  'claude-3-5-sonnet': {
    displayName: 'Claude 3.5 Sonnet',
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedInputPerMillion: 0.3,
  },
  'claude-3-5-haiku': {
    displayName: 'Claude 3.5 Haiku',
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cachedInputPerMillion: 0.08,
  },
  'claude-3-opus': {
    displayName: 'Claude 3 Opus',
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cachedInputPerMillion: 1.5,
  },

  // Google Gemini
  'gemini-2-0-flash': {
    displayName: 'Gemini 2.0 Flash',
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    cachedInputPerMillion: 0.025,
  },
  'gemini-2-0-pro': {
    displayName: 'Gemini 2.0 Pro',
    inputPerMillion: 1.25,
    outputPerMillion: 5.0,
    cachedInputPerMillion: 0.3125,
  },
  'gemini-1-5-pro': {
    displayName: 'Gemini 1.5 Pro',
    inputPerMillion: 1.25,
    outputPerMillion: 5.0,
    cachedInputPerMillion: 0.3125,
  },
  'gemini-1-5-flash': {
    displayName: 'Gemini 1.5 Flash',
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    cachedInputPerMillion: 0.01875,
  },

  // DeepSeek
  'deepseek-chat': {
    displayName: 'DeepSeek-V3',
    inputPerMillion: 0.14,
    outputPerMillion: 0.28,
    cachedInputPerMillion: 0.014,
  },
  'deepseek-reasoner': {
    displayName: 'DeepSeek-R1',
    inputPerMillion: 0.55,
    outputPerMillion: 2.19,
    cachedInputPerMillion: 0.14,
  },
};

export interface TokenCostParams {
  modelKey: string;
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens?: number;
  reasoningTokens?: number;
  customInputRate?: number;
  customOutputRate?: number;
}

/**
 * Calculates estimated USD cost from prompt, completion, cached, and reasoning token counts.
 */
export function calculateTokenCostUsd(
  paramsOrModel: string | TokenCostParams,
  promptTokens = 0,
  completionTokens = 0,
  customInputRate?: number,
  customOutputRate?: number,
): number {
  let modelKey = 'gpt-4o';
  let pTokens = promptTokens;
  let cTokens = completionTokens;
  let cachedTokens = 0;
  let reasoningTokens = 0;
  let inRateOverride = customInputRate;
  let outRateOverride = customOutputRate;

  if (typeof paramsOrModel === 'object') {
    modelKey = paramsOrModel.modelKey;
    pTokens = paramsOrModel.promptTokens || 0;
    cTokens = paramsOrModel.completionTokens || 0;
    cachedTokens = paramsOrModel.cachedPromptTokens || 0;
    reasoningTokens = paramsOrModel.reasoningTokens || 0;
    inRateOverride = paramsOrModel.customInputRate;
    outRateOverride = paramsOrModel.customOutputRate;
  } else {
    modelKey = paramsOrModel;
  }

  let inRate = 0;
  let outRate = 0;
  let cachedRate = 0;

  if (modelKey === 'custom') {
    inRate = inRateOverride || 0;
    outRate = outRateOverride || 0;
    cachedRate = inRate * 0.5;
  } else {
    const pricing = MODEL_PRICING_TABLE[modelKey] || MODEL_PRICING_TABLE['gpt-4o'];
    inRate = pricing.inputPerMillion;
    outRate = pricing.outputPerMillion;
    cachedRate = pricing.cachedInputPerMillion ?? inRate * 0.5;
  }

  // Non-cached prompt tokens = total prompt tokens minus cached tokens
  const billableStandardInput = Math.max(0, pTokens - cachedTokens);
  const promptCost = (billableStandardInput / 1_000_000) * inRate;
  const cachedPromptCost = (cachedTokens / 1_000_000) * cachedRate;

  // Total output tokens = completion tokens + reasoning tokens
  const totalOutputTokens = cTokens + reasoningTokens;
  const completionCost = (totalOutputTokens / 1_000_000) * outRate;

  const total = promptCost + cachedPromptCost + completionCost;

  // Round to 6 decimal places for precision
  return Math.round(total * 1_000_000) / 1_000_000;
}
