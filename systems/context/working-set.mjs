import { dedupeContextBlocks, selectContextBlocks } from '../token/index.mjs';

export function buildWorkingSet(input = {}, options = {}) {
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const result = selectContextBlocks(dedupeContextBlocks(blocks), options);
  return {
    task: String(input.task || ''),
    constraints: Array.isArray(input.constraints) ? [...new Set(input.constraints.map(String))] : [],
    decisions: Array.isArray(input.decisions) ? [...new Set(input.decisions.map(String))] : [],
    evidence: result.blocks.filter((b) => b.kind === 'evidence').map((b) => b.text),
    changed: result.blocks.filter((b) => b.kind === 'changed').map((b) => b.text),
    unresolved: Array.isArray(input.unresolved) ? [...new Set(input.unresolved.map(String))] : [],
    selectedTokens: result.estimatedTokens,
    tokenBudget: result.budget,
  };
}
