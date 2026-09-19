const SEO_SIGNAL = /\b(seo|search engine|google search|index|indexing|crawl|crawler|sitemap|robots\.txt|canonical|structured data|schema\.org|meta description|title tag|og:|open graph)\b/i;
const TECH_SIGNAL = /\b(next\.js|nuxt|astro|sveltekit|vite|react|vue|html|wordpress|shopify|web app|website)\b/i;

export function classifySeoRequest(prompt = '') {
  const text = String(prompt || '').trim();
  const isSeo = SEO_SIGNAL.test(text);
  return Object.freeze({
    isSeo,
    technical: TECH_SIGNAL.test(text),
    researchFirst: isSeo,
    indexable: !/\b(noindex|private|internal-only|admin)\b/i.test(text),
  });
}

export function buildSeoTaskFrame(prompt = '') {
  const task = classifySeoRequest(prompt);
  if (!task.isSeo) return '';
  return `[SEO] research=mandatory; inspect=routes/rendered-html/metadata/build; title+description=unique; canonical=single-intent; crawlability=semantic-links; index-control=explicit; structured-data=visible-accurate; js=search-accessible; sitemap=when-useful; robots!=noindex; content=intent-led/not-keyword-stuffed; verify=rendered-output + rich-results/url-inspection when available; performance=mobile/desktop`;
}

export function buildSeoSystemPrompt() {
  return [
    '## LazyDev SEO System',
    'SEO work is a technical implementation and verification task, not a ranking promise. Research current search guidance before policy-sensitive decisions, then inspect the real application.',
    'Indexable pages need unique descriptive titles and useful meta descriptions, an intentional canonical, semantic HTML, crawlable links, coherent content, and explicit indexability controls. Preserve established URL structure during redesigns unless the user requests a migration.',
    "JavaScript must not hide the page's essential meaning from crawlers. Where content is separately addressable, use real URLs and ensure important content is present in rendered HTML or an equivalent crawlable representation.",
    'Structured data is optional enhancement, not filler: it must be valid, relevant, accurate, and consistent with visible content. Prefer JSON-LD and validate it when possible.',
    'Sitemaps help discovery for larger/complex sites but do not guarantee crawling or indexing. `robots.txt` controls crawling; use `noindex` or access control for indexing restrictions as appropriate.',
    'Do not keyword-stuff, fabricate reviews/claims, create thin doorway pages, or add markup for hidden/inaccurate content. Check image alt text, internal links, redirects, performance, accessibility, mobile behavior, and Core Web Vitals.',
  ].join('\n');
}

function count(re, text) { return text.match(re)?.length || 0; }

export function auditSeoSource(source = '') {
  const html = String(source || '');
  const lower = html.toLowerCase();
  const checks = [
    ['title', /<title\b[^>]*>\s*[^<\n]+\s*<\/title>/i, 'unique descriptive title'],
    ['meta-description', /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+['"]/i, 'meta description'],
    ['canonical', /<link[^>]+rel=["']canonical["'][^>]+href=/i, 'canonical link'],
    ['lang', /<html[^>]+lang=["'][^"']+['"]/i, 'document language'],
    ['semantic-main', /<main\b/i, 'semantic main landmark'],
    ['crawlable-links', /<a\b[^>]+href=/i, 'crawlable links'],
    ['image-alt', /<img\b[^>]+alt=["']/i, 'image alt text'],
    ['structured-data', /application\/ld\+json/i, 'structured data when relevant'],
  ];
  const result = checks.map(([id, re, rule]) => ({ id, rule, pass: re.test(html) }));
  return {
    score: Math.round(result.filter((x) => x.pass).length / result.length * 100),
    checks: result,
    titleCount: count(/<title\b/gi, html),
    canonicalCount: count(/rel=["']canonical["']/gi, html),
    noindex: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(lower),
  };
}
