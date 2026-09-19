import assert from 'node:assert/strict';
import { compressAgenticMessages, FOVEANCE_DEFAULTS } from '../token/foveance.mjs';

const repeated = Array.from({ length: 30 }, (_, i) => `src/services/cache/module-${i % 5}.ts: ERROR timeout=429 request failed key=cache-item`).join('\n');
const messages = [
  { role: 'assistant', content: 'inspect complete' },
  { role: 'tool', tool_call_id: 'call-1', content: repeated },
  { role: 'assistant', content: 'retrying' },
  { role: 'tool', tool_call_id: 'call-2', content: repeated },
  { role: 'assistant', content: 'final step' },
];
const result = compressAgenticMessages(messages, { protectLast: 1, minChars: 256 });
assert.equal(result.changed, true);
assert.ok(result.savedTokens > 0);
assert.ok(result.references > 0);
assert.ok(result.afterChars < result.beforeChars);
assert.equal(result.messages[result.messages.length - 1].content, 'final step', 'recent context must remain untouched');
assert.equal(result.messages[1].tool_call_id, 'call-1', 'tool-call IDs must remain intact');
assert.equal(result.messages[3].tool_call_id, 'call-2', 'tool-call IDs must remain intact');
assert.ok(String(result.messages[3].content).includes('[lazy-repeat'), 'repeat marker missing');

const cacheProtected = [{
  role: 'assistant',
  content: [{ type: 'tool_result', content: repeated, cache_control: { type: 'ephemeral' } }],
}];
const cacheResult = compressAgenticMessages(cacheProtected, { protectLast: 0, minChars: 256 });
assert.equal(cacheResult.changed, false, 'cache protected blocks must not be modified');


const templateInput = Array.from({ length: 24 }, (_, i) => `GET /api/v1/resource/${i} content-type=application/json request-id=abcdefghijklmnopqrstuvwxyz0123456789 payload=value-${i}`).join('\n');
const templateMessages = [
  { role: 'tool', content: templateInput },
  { role: 'assistant', content: 'continue' },
];
const templateResult = compressAgenticMessages(templateMessages, { protectLast: 0, minChars: 256, template: true, templateMinSavedTokens: 16 });
assert.equal(templateResult.changed, true, 'template pass should trigger on measurable shared-prefix redundancy');
assert.ok(templateResult.templateSavedTokens > 0, 'template pass must report real savings');
assert.ok(String(templateResult.messages[0].content).includes('[lazy-template'), 'template marker missing');

const boundaryMessages = [
  { role: 'assistant', content: [{ type: 'text', text: 'cache anchor', cache_control: { type: 'ephemeral' } }] },
  { role: 'tool', content: repeated },
  { role: 'tool', content: repeated },
  { role: 'assistant', content: 'latest' },
];
const boundaryResult = compressAgenticMessages(boundaryMessages, { protectLast: 1, minChars: 256 });
assert.equal(boundaryResult.cacheBoundary, 0);
assert.equal(boundaryResult.messages[0].content[0].text, boundaryMessages[0].content[0].text, 'cache boundary message must remain unchanged');
assert.equal(boundaryResult.messages[0].content[0].cache_control.type, 'ephemeral');
assert.ok(boundaryResult.messages[2].content !== boundaryMessages[2].content, 'messages after cache boundary may be compressed');

const defaults = FOVEANCE_DEFAULTS;
assert.equal(defaults.protectLast, 6);
console.log(`PASS: Foveance-inspired transport codec saves ${result.savedTokens} estimated tokens across ${result.references} reference(s)`);
