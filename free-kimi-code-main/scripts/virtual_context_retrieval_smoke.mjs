import assert from 'node:assert/strict';
import { VirtualContextStore } from '../systems/context/virtual-store.mjs';

const store = new VirtualContextStore({ multiplier: 2 });
store.setPhysicalContext(32768);
const messages = [
  { role: 'user', content: 'Build the TikTok downloader page in tiktok.html with a working preview, no-watermark result, download button, responsive behavior, and the existing visual hierarchy. Keep the implementation focused on this page and its direct dependencies.' },
  { role: 'assistant', content: 'Implemented the downloader flow, preview event handling, validation wiring, responsive states, and download action in tiktok.html. The preview is driven by the URL form and result state and does not require unrelated pages.' },
  { role: 'user', content: 'There is an unrelated anime catalog in anime.html. Leave it untouched, do not copy its content, and do not change its styles or markup as part of the downloader work.' },
  { role: 'assistant', content: 'The anime catalog is a separate page with unrelated card content in anime.html. Keep the downloader isolated to tiktok.html and its direct dependencies, with no cross-page edits.' },
  { role: 'user', content: 'Add a URL input validation message and keep the downloader layout unchanged. Do not redesign or inspect the unrelated anime page unless the current downloader implementation directly imports it.' },
  { role: 'assistant', content: 'Validation stays local to the downloader form and does not require changes to anime.html. The existing downloader layout remains the active implementation surface and responsive behavior stays intact.' },
  { role: 'user', content: 'Now continue with the downloader preview issue and preserve responsive behavior in tiktok.html. The task remains limited to the downloader page.' },
  { role: 'assistant', content: 'The preview issue is isolated to tiktok.html; no change is needed to the unrelated anime catalog page. The active work surface remains the downloader preview implementation.' },
  { role: 'user', content: 'Keep responsive behavior intact and only adjust the downloader preview flow in tiktok.html. Avoid reading unrelated HTML files.' },
  { role: 'assistant', content: 'Responsive behavior remains intact and the preview flow is scoped to the downloader page. Unrelated HTML pages are outside the task scope.' },
  { role: 'user', content: 'Fix preview in tiktok.html' },
];
store.ingestMessages(messages, 3);
const result = store.retrieve('fix preview in tiktok.html downloader', ['tiktok.html'], 2000);
const rendered = store.render(result, ['tiktok.html']);
assert.ok(result.segments.length >= 1);
assert.match(rendered, /tiktok\.html/u);
assert.doesNotMatch(rendered, /anime\.html/u);
assert.ok(store.capacityTokens >= 65536);
console.log('PASS: virtual context uses relevance + file affinity and avoids unrelated archived HTML');
