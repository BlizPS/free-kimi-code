const SLOP = Object.freeze({
  card_soup: /\b(card|tile|panel)\b/gi,
  gradient: /\b(linear-gradient|radial-gradient|gradient)\b/gi,
  glass: /\b(backdrop-filter|glassmorphism|frosted glass|glass)\b/gi,
  pills: /\bborder-radius\s*:\s*(9999|999|50%)|pill/gi,
  hero: /\bhero\b/gi,
  icon_pile: /\b(icon|lucide|heroicons|fontawesome)\b/gi,
  fake_data: /\bLorem ipsum|Jane Doe|John Doe|123 Main St|example@example\.com\b/gi,
});

const GOOD = Object.freeze({
  states: /\b(loading|empty|error|success|disabled|focus|hover|pressed|selected)\b/i,
  responsive: /\b(min-width|max-width|clamp\(|grid-template|flex-wrap|media query)\b/i,
  semantic: /\b(aria-|role=|button|label|nav|main|section|header|form)\b/i,
  tokens: /var\(--|--[a-z0-9-]+|design token|spacing scale|type scale/i,
});

export function analyzeUiSource(source = '') {
  const text = String(source || '');
  const signals = Object.fromEntries(Object.entries(SLOP).map(([key, pattern]) => [key, (text.match(pattern) || []).length]));
  const strengths = Object.fromEntries(Object.entries(GOOD).map(([key, pattern]) => [key, pattern.test(text)]));
  const slopScore = Math.min(100, signals.card_soup * 2 + signals.gradient * 8 + signals.glass * 8 + signals.pills * 3 + signals.hero * 4 + signals.icon_pile * 1 + signals.fake_data * 12);
  const qualityScore = Math.min(100, Object.values(strengths).filter(Boolean).length * 12);
  return { slopScore, qualityScore, signals, strengths };
}

export function uiCorrections(analysis = {}) {
  const fixes = [];
  if (Number(analysis.signals?.gradient) > 2) fixes.push('reduce decorative gradients');
  if (Number(analysis.signals?.glass) > 1) fixes.push('reduce glass effects');
  if (Number(analysis.signals?.card_soup) > 6) fixes.push('replace repetitive cards with hierarchy or sections');
  if (Number(analysis.signals?.fake_data) > 0) fixes.push('replace invented data with real states or repository data');
  if (!analysis.strengths?.states) fixes.push('implement explicit interaction states');
  if (!analysis.strengths?.responsive) fixes.push('add narrow-width and overflow behavior');
  if (!analysis.strengths?.semantic) fixes.push('use semantic controls and accessible labels');
  return fixes;
}
