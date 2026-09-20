const CURRENT_SIGNAL = /\b(latest|current|today|this week|newest|recent|202[5-9]|documentation|docs|api changes|release|version)\b/i;
const NAMED_REFERENCE = /\b(kimi code|claude code|github|official docs|documentation|site|website|reference|inspired by|similar to|match)\b/i;
const VISUAL_COMPLEXITY = /\b(ui|ux|frontend|responsive|animation|design system|landing page|dashboard|editor|workspace)\b/i;

export function needsResearch(task = {}, options = {}) {
  const text = String(task.text || task || '');
  if (options.force === true) return true;
  if (options.disable === true) return false;
  return CURRENT_SIGNAL.test(text) || NAMED_REFERENCE.test(text) || (task.primary === 'ui' && VISUAL_COMPLEXITY.test(text));
}

export function buildResearchQuery(task = {}) {
  const text = String(task.text || task || '').trim();
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').slice(0, 420);
  return `${cleaned} official documentation current implementation patterns`;
}

export function normalizeResearchResult(result = {}) {
  return Object.freeze({
    title: String(result.title || ''),
    url: String(result.url || ''),
    source: String(result.source || ''),
    summary: String(result.summary || result.snippet || ''),
    fetchedAt: Number(result.fetchedAt || Date.now()),
  });
}
