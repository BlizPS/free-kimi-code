export function buildClaudeTokenHookContext(input = {}) {
  const mode = input.simple ? 'direct' : input.deep ? 'deep' : 'focused';
  const budget = input.responseBudget || (input.simple ? 120 : input.deep ? 420 : 220);
  return `Result first. No preamble, recap, praise, tool diary, or hidden-process narration. Response budget≈${budget}. Preserve exact code, paths, URLs, identifiers, versions, errors, negation, and order. Mode=${mode}.`;
}
