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
const UI_FACTUAL = /\b(history|historical|sejarah|tahun|year|statistic|statistics|data|biography|biografi|timeline|event|peristiwa)\b/i;
const UI_3D = /\b(3d|three(?:\.js)?|webgl|webgpu|canvas 3d|gltf|glb|shader|babylon)\b/i;
const UI_SEO = /\b(seo|search engine|google search|indexing|crawl|sitemap|robots\.txt|canonical|structured data|schema\.org|meta description|title tag|open graph|og:)\b/i;

export const UI_INTELLIGENCE_RULES = Object.freeze([
  'Design for the actual product; preserve existing identity unless redesign is requested.',
  'Before writing, inspect UI/stack/assets/routes/tokens. Research one targeted reference first for named/external or non-trivial UI when search is available.',
  'Extract patterns, never copy: hierarchy, density, type, color roles, components, states, navigation, and motion.',
  'Choose one visual family and one clear visual anchor; define content, responsive rules, component hierarchy, and states before decoration. Implement real loading/empty/error/success/disabled/focus/touch/keyboard/reduced-motion states when relevant.',
  'Reject filler UI, fake data/controls, decorative icon piles, gradients, glass, pill-everything, giant rounded cards, and oversized heroes unless the product proves they belong.',
  'Stress mobile/tablet/desktop, long text, wrapping, touch/keyboard, assets, contrast, reduced motion, and performance; visually verify when possible.',
  'Content integrity: when UI copy contains dates, history, statistics, named events, or factual claims, research an authoritative source first; never invent a year or reuse the current year as a historical fact.',
  'Asset integrity: never guess image URLs. Prefer verified local assets, verified remote assets, or inline SVG/CSS. Before completion, verify every local image path exists and every remote image URL was actually checked; never ship placeholder/broken image references.',
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
  const factual = UI_FACTUAL.test(text);
  const threeD = UI_3D.test(text);
  const seo = UI_SEO.test(text);
  const designIntelligence = isUi && (build || reference || complex);
  return Object.freeze({
    isUi,
    domain,
    reference,
    preserve,
    complex,
    build,
    designIntelligence,
    factual,
    threeD,
    seo,
    researchFirst: isUi && (reference || complex || factual || threeD || seo),
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
    `content=${task.factual ? 'fact-check-first' : 'implementation-copy'}`,
    `complexity=${task.complex ? 'non-trivial' : 'focused'}`,
    `design-engine=${task.designIntelligence ? 'required-first' : 'off'}`,
    `3d=${task.threeD ? 'research-mandatory' : 'off'}`,
    `seo=${task.seo ? 'research-mandatory' : 'off'}`,
  ];
  return `[UI] ${flags.join('; ')}`;
}

export function buildUiSystemPrompt() {
  return [
    '## Built-in UI Generation Intelligence',
    'This protocol is always active for UI/frontend work; it does not depend on a Skill.',
    'For UI builds, use the local personal Pro design-intelligence engine BEFORE writing code. The runtime may precompile a compact turn-specific design context; read that context first and treat it as the design contract for the turn.',
    'Use the returned pattern/style/palette/type/density/motion/UX/anti-pattern decisions as implementation constraints. Prefer existing repository tokens/components. For named external references, also research the current reference before coding.',
    `Today is ${new Date().toISOString().slice(0, 10)}. For current/latest/today claims, the displayed current year must match today's year; historical years require a researched source. Never use the current year as a historical event year.`,
    'Execution order: inspect → local design search → external research when factual or named reference content is present → define system → implement behavior → verify copy/assets → stress responsive states → polish only mismatches. Prefer self-contained image assets so standalone HTML works when opened locally.',
    ...UI_INTELLIGENCE_RULES.map((rule, index) => `${index + 1}. ${rule}`),
  ].join('\n');
}
