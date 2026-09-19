const UI_SIGNALS = Object.freeze({
  dashboard: /\b(dashboard|admin|analytics|metrics|monitoring|backoffice)\b/i,
  application: /\b(app|application|workspace|editor|ide|chat|messaging|settings|productivity)\b/i,
  media: /\b(video|audio|music|photo|gallery|streaming|player|media)\b/i,
  commerce: /\b(shop|store|commerce|checkout|cart|marketplace|product)\b/i,
  marketing: /\b(landing page|marketing|marketing site|homepage|hero section|campaign|portfolio)\b/i,
  form: /\b(form|wizard|onboarding|signup|login|configuration|settings form)\b/i,
});

const UI_REQUEST = /\b(ui|ux|frontend|front-end|web app|website|web page|landing page|dashboard|component|design system|responsive|mobile ui|animation|visual design)\b/i;
const UI_REFERENCE = /\b(reference|inspiration|inspired by|like|similar to|match|recreate|clone|copy|use .* as reference|kimi code|kimi code ui)\b/i;
const UI_PRESERVE = /\b(keep|preserve|don't redesign|do not redesign|existing design|existing ui|same ui|same design|current ui|current design)\b/i;
const UI_COMPLEX = /\b(multi-page|multiple pages|full app|complete app|production|polished|professional|interactive|animation|responsive|mobile|desktop|states|accessibility|design system)\b/i;
const UI_BUILD = /\b(build|create|make|implement|design|redesign|polish|improve|fix|refactor|generate)\b/i;

export const UI_INTELLIGENCE_RULES = Object.freeze([
  'Design for the actual product; preserve existing identity unless redesign is requested.',
  'Before writing, inspect UI/stack/assets/routes/tokens. Research one targeted reference first for named/external or non-trivial UI when search is available.',
  'Extract patterns, never copy: hierarchy, density, type, color roles, components, states, navigation, and motion.',
  'Choose one visual family and one clear visual anchor; define content, responsive rules, component hierarchy, and states before decoration. Implement real loading/empty/error/success/disabled/focus/touch/keyboard/reduced-motion states when relevant.',
  'Reject filler UI, fake data/controls, decorative icon piles, gradients, glass, pill-everything, giant rounded cards, and oversized heroes unless the product proves they belong.',
  'Stress mobile/tablet/desktop, long text, wrapping, touch/keyboard, assets, contrast, reduced motion, and performance; visually verify when possible.',
  'For Kimi Code-like references, favor focused task surfaces, clear progress, inspectable work, useful supporting context, and restrained chrome when appropriate.',
]);

export function classifyUiRequest(prompt = '') {
  const text = String(prompt || '').trim();
  const isUi = UI_REQUEST.test(text);
  const domain = Object.entries(UI_SIGNALS).find(([, pattern]) => pattern.test(text))?.[0] || 'product';
  const reference = UI_REFERENCE.test(text);
  const preserve = UI_PRESERVE.test(text);
  const complex = UI_COMPLEX.test(text);
  const build = UI_BUILD.test(text);
  const designIntelligence = isUi && (build || reference || complex);
  return Object.freeze({
    isUi,
    domain,
    reference,
    preserve,
    complex,
    build,
    designIntelligence,
    researchFirst: isUi && (reference || complex),
  });
}

export function buildUiTaskContext(prompt = '') {
  const task = classifyUiRequest(prompt);
  if (!task.isUi) return '';
  const flags = [
    `domain=${task.domain}`,
    `research=${task.researchFirst ? 'first' : 'when-needed'}`,
    `reference=${task.reference ? 'named-or-external' : 'none'}`,
    `identity=${task.preserve ? 'preserve' : 'infer-from-repo'}`,
    `complexity=${task.complex ? 'non-trivial' : 'focused'}`,
    `design-engine=${task.designIntelligence ? 'required-first' : 'off'}`,
  ];
  return `[UI] ${flags.join('; ')}`;
}

export function buildUiSystemPrompt() {
  return [
    '## Built-in UI Generation Intelligence',
    'This protocol is always active for UI/frontend work; it does not depend on a Skill.',
    'For UI builds, use the local personal Pro design-intelligence engine BEFORE writing code. The runtime may precompile a compact turn-specific design context; read that context first and treat it as the design contract for the turn.',
    'Use the returned pattern/style/palette/type/density/motion/UX/anti-pattern decisions as implementation constraints. Prefer existing repository tokens/components. For named external references, also research the current reference before coding.',
    'Execution order: inspect → local design search → external research when warranted → define system → implement behavior → stress responsive states → verify → polish only mismatches.',
    ...UI_INTELLIGENCE_RULES.map((rule, index) => `${index + 1}. ${rule}`),
  ].join('\n');
}
