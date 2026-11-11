import { calculateTokenCostUsd } from '../utils/pricing_table';

export interface CircuitBreakerOptions {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  cachedPromptTokens?: number;
  reasoningTokens?: number;
  iterationCount?: number;
  maxCostUsd?: number;
  maxIterations?: number;
  customInputRate?: number;
  customOutputRate?: number;
}

export interface CircuitBreakerResult {
  isBreached: boolean;
  status: 'PASSED' | 'BREACHED';
  estimatedCostUsd: number;
  currentIteration: number;
  totalTokens: number;
  breachedReasons: string[];
  limits: {
    maxCostUsd?: number;
    maxIterations?: number;
  };
}

/**
 * Evaluates whether an execution stays within configured cost and loop limits.
 */
export function evaluateCircuitBreaker(options: CircuitBreakerOptions): CircuitBreakerResult {
  const model = options.model || 'gpt-4o';
  const promptTokens = Math.max(0, options.promptTokens || 0);
  const completionTokens = Math.max(0, options.completionTokens || 0);
  const cachedPromptTokens = Math.max(0, options.cachedPromptTokens || 0);
  const reasoningTokens = Math.max(0, options.reasoningTokens || 0);
  const totalTokens = promptTokens + completionTokens + reasoningTokens;
  const iterationCount = Math.max(0, options.iterationCount || 1);

  const estimatedCostUsd = calculateTokenCostUsd({
    modelKey: model,
    promptTokens,
    completionTokens,
    cachedPromptTokens,
    reasoningTokens,
    customInputRate: options.customInputRate,
    customOutputRate: options.customOutputRate,
  });

  const breachedReasons: string[] = [];

  // 1. Budget check
  if (options.maxCostUsd !== undefined && options.maxCostUsd > 0) {
    if (estimatedCostUsd > options.maxCostUsd) {
      breachedReasons.push(
        `Cost limit exceeded: estimated \$${estimatedCostUsd} > allowed \$${options.maxCostUsd}`,
      );
    }
  }

  // 2. Loop iteration check
  if (options.maxIterations !== undefined && options.maxIterations > 0) {
    if (iterationCount > options.maxIterations) {
      breachedReasons.push(
        `Iteration depth exceeded: current iteration ${iterationCount} > allowed max ${options.maxIterations}`,
      );
    }
  }

  const isBreached = breachedReasons.length > 0;

  return {
    isBreached,
    status: isBreached ? 'BREACHED' : 'PASSED',
    estimatedCostUsd,
    currentIteration: iterationCount,
    totalTokens,
    breachedReasons,
    limits: {
      maxCostUsd: options.maxCostUsd,
      maxIterations: options.maxIterations,
    },
  };
}
