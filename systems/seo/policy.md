# SEO Engineering Policy

SEO tasks are evidence-first. Research current search-engine guidance before making version-sensitive or policy-sensitive claims, then inspect the repository's actual routes, rendered HTML, metadata, content, and build setup. SEO is not a promise of ranking; the goal is crawlability, understandable content, correct indexing controls, useful search appearance, and strong page quality.

## Technical baseline

- Use unique, descriptive `<title>` and meta descriptions per indexable page.
- Set one intentional canonical URL per page and avoid conflicting canonicals.
- Use semantic HTML and real crawlable `<a href>` links; make important pages discoverable through internal linking.
- Provide a sitemap when it is useful for the site's size, complexity, media, or discoverability; do not treat a sitemap as a guarantee of crawling/indexing.
- Use `robots.txt` for crawl controls, not as a substitute for `noindex` or access control. Keep indexability intent explicit.
- For JavaScript apps, ensure important content and canonical information are available to crawlers and give independently meaningful content its own URL when needed.
- Use structured data only when it accurately describes visible, relevant content. Prefer JSON-LD where practical and validate it with current rich-result tooling.
- Preserve existing URLs and migration signals during redesigns unless the user explicitly asks for routing changes.

## Content baseline

- Write for the user's search intent and the actual page topic, not keyword density.
- Make important information textual and accessible in the DOM; do not hide essential copy in CSS-generated content or canvas-only rendering.
- Keep headings, copy, links, image `alt` text, and structured data consistent with the visible page.
- Avoid duplicate, thin, fabricated, or keyword-stuffed content and fake reviews/claims.

## Performance and UX

- Treat performance, accessibility, mobile support, and security as part of search quality.
- For Core Web Vitals, use current field targets and measure representative mobile/desktop traffic; the commonly documented good targets are LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1 at the 75th percentile.
- Reserve image dimensions, avoid layout shifts, prioritize the page's main content, and defer non-critical work.

## Verification

Before claiming SEO is optimized, check metadata, canonical, indexability controls, internal links, sitemap/robots behavior, structured data, rendered content, redirects where relevant, image semantics, and performance. Use URL Inspection and Rich Results Test when the environment permits.

## Source basis

Google Search Central: SEO Starter Guide, JavaScript SEO basics, developer guide, sitemaps, structured data documentation. Web Vitals: web.dev/vitals.
