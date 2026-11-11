import { decryptVault } from '../utils/crypto';

export interface RehydrateOptions {
  vaultSecret?: string;
  leaveUnmatchedTokens?: boolean;
}

export interface RehydrateResult {
  restoredText?: string;
  restoredJson?: unknown;
  restoredCount: number;
}

/**
 * Replaces tokens in a single string using the decrypted vault mapping.
 */
function restoreString(
  text: string,
  mapping: Record<string, string>,
): { restored: string; count: number } {
  if (!text || typeof text !== 'string') {
    return { restored: text, count: 0 };
  }

  let count = 0;
  let restored = text;

  // Replace each mapped token
  for (const [token, original] of Object.entries(mapping)) {
    if (restored.includes(token)) {
      // Use split and join to replace all occurrences efficiently
      const occurrences = restored.split(token).length - 1;
      if (occurrences > 0) {
        restored = restored.split(token).join(original);
        count += occurrences;
      }
    }
  }

  return { restored, count };
}

/**
 * Traverses JSON structure and restores tokens in all string fields.
 */
function traverseAndRestoreJson(
  data: unknown,
  mapping: Record<string, string>,
  counter: { total: number },
): unknown {
  if (typeof data === 'string') {
    const { restored, count } = restoreString(data, mapping);
    counter.total += count;
    return restored;
  }

  if (Array.isArray(data)) {
    return data.map((item) => traverseAndRestoreJson(item, mapping, counter));
  }

  if (data !== null && typeof data === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      newObj[key] = traverseAndRestoreJson(value, mapping, counter);
    }
    return newObj;
  }

  return data;
}

/**
 * Main rehydration function restoring masked tokens to their original values.
 */
export function rehydrate(
  input: string | Record<string, unknown> | unknown[],
  piiVault: string,
  options: RehydrateOptions = {},
): RehydrateResult {
  if (!piiVault) {
    throw new Error('Missing piiVault token for rehydration');
  }

  const payload = decryptVault(piiVault, options.vaultSecret);
  const mapping = payload.mapping || {};

  let restoredText: string | undefined;
  let restoredJson: unknown | undefined;
  let restoredCount = 0;

  if (typeof input === 'string') {
    const res = restoreString(input, mapping);
    restoredText = res.restored;
    restoredCount = res.count;
  } else {
    const counter = { total: 0 };
    restoredJson = traverseAndRestoreJson(input, mapping, counter);
    restoredCount = counter.total;
  }

  return {
    restoredText,
    restoredJson,
    restoredCount,
  };
}
