const LAZY_MARKERS = [
  /lazydev/i,
  /\[lz\]/i,
  /\[domain\]/i,
  /\[ui\]/i,
  /\[taste\]/i,
  /\[agent\]/i,
  /\[verify\]/i,
  /\[resp\]/i,
  /\[lang\]/i,
  /\[fact-check\]/i,
  /built-in ui generation intelligence/i,
  /lazydev intelligence aliases/i,
  /lazydev taste system/i,
  /lazydev runtime/i,
];

function textOf(message) {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) return message.content.map((part) => part?.text ?? part?.content ?? '').join('\n');
  try { return message?.content == null ? '' : JSON.stringify(message.content); } catch { return String(message?.content || ''); }
}

function taskFlags(prompt = '') {
  const text = String(prompt || '');
  return {
    ui: /\b(ui|ux|frontend|front-end|website|web page|landing page|dashboard|component|responsive|animation|design system|3d|three\.js|webgl)\b/i.test(text),
    threeD: /\b(3d|three(?:\.js)?|webgl|webgpu|babylon|gltf|glb)\b/i.test(text),
    seo: /\b(seo|search engine|indexing|crawl|sitemap|robots\.txt|canonical|structured data|schema\.org|meta description|title tag|open graph)\b/i.test(text),
    artifact: /\b(create|build|make|generate|write|save|export|download|artifact|html|css|js|json|zip|pdf|docx|xlsx|png|svg)\b/i.test(text),
    debug: /\b(error|bug|broken|fix|crash|fail|failing|timeout|regression|wrong)\b/i.test(text),
  };
}

function compactFrame(prompt = '') {
  const flags = taskFlags(prompt);
  const details = [
    'scope=focused',
    'flow=inspect→minimal-change→verify',
    'context=progressive,deduplicated,relevant-only',
    'preserve=code,paths,urls,errors,negation,acceptance',
  ];
  if (flags.ui) details.push('ui=preserve-existing;real-states;responsive');
  if (flags.threeD) details.push('3d=research-current-reference-before-first-write');
  if (flags.seo) details.push('seo=research-current-guidance+inspect-rendered-metadata-before-claim');
  if (flags.artifact) details.push('artifact=verify-exact-final-path');
  if (flags.debug) details.push('debug=evidence-first;verify-regression');
  return `[LazyDev Compact Contract] ${details.join(';')}`;
}

export function isLazyDevSystemMessage(message) {
  if (!message || message.role !== 'system') return false;
  const text = textOf(message);
  return LAZY_MARKERS.some((re) => re.test(text));
}

export function pruneLazyDevSystemMessages(messages = [], prompt = '') {
  const source = Array.isArray(messages) ? messages : [];
  const hadLazy = source.some(isLazyDevSystemMessage);
  if (!hadLazy) return { messages: source, changed: false, savedChars: 0 };
  const compact = compactFrame(prompt);
  const kept = source.filter((message) => !isLazyDevSystemMessage(message));
  const firstSystem = kept.findIndex((message) => message && message.role === 'system');
  const insertAt = firstSystem >= 0 ? firstSystem : 0;
  kept.splice(insertAt, 0, { role: 'system', content: compact });
  const beforeChars = source.reduce((n, m) => n + textOf(m).length, 0);
  const afterChars = kept.reduce((n, m) => n + textOf(m).length, 0);
  return { messages: kept, changed: true, savedChars: Math.max(0, beforeChars - afterChars) };
}
