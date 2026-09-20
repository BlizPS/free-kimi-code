import { buildTokenEconomyFrame, estimateTokens, selectContextBlocks } from './index.mjs';
import { computeTokenBudget, shouldCompact, remainingTokens } from './budget.mjs';
import { compactText, compactMessages } from './compaction.mjs';
import { compactToolResult } from './observation.mjs';
import { buildPromptCacheKey } from './cachekey.mjs';
import { buildCompactHandoff } from './handoff.mjs';
import { TokenLedger } from './metrics.mjs';
import { dedupeCalls } from './dedupe.mjs';
import { compressAgenticMessages, FOVEANCE_DEFAULTS } from './foveance.mjs';

export function createTokenSystem(options = {}) {
  const ledger = new TokenLedger();
  return Object.freeze({
    ledger,
    estimateTokens,
    budget: computeTokenBudget(options),
    shouldCompact,
    remainingTokens,
    selectContextBlocks,
    compactText,
    compactMessages,
    compactToolResult,
    buildPromptCacheKey,
    buildCompactHandoff,
    dedupeCalls,
    compressAgenticMessages,
    foveanceDefaults: FOVEANCE_DEFAULTS,
    frame: (stats = {}) => buildTokenEconomyFrame(stats),
  });
}
