import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const errors = [];

if (!src.includes("function isAntigravityModel(modelId)")) errors.push('Antigravity classifier missing for disabled-model migration');
if (!src.includes("return models.filter((m) => !isAntigravityModel(m.id));")) errors.push('Disabled Antigravity models must be hidden from Gemini setup catalog');
if (!src.includes("if (isAntigravityModel(pc.model))")) errors.push('Legacy saved Antigravity config guard missing');
if (!src.includes("const fallback = providers.find((candidate) => {")) errors.push('Disabled-model fallback migration missing');
if (src.includes("createAntigravityProxy({")) errors.push('Antigravity proxy must not be started by LazyDev');
if (!src.includes("ANTIGRAVITY_AGENT = 'antigravity-preview-09-2026'")) errors.push('Disabled model identifier missing');

const resilience = await import('../runtime/gemini-resilience.mjs');
const prepared = resilience.prepareGeminiRequest({ model: 'gemini-flash-lite-latest', max_tokens: 512, max_completion_tokens: 512, reasoning_effort: 'low', extra_body: { google: { thinking_config: { thinking_level: 'low' } } } }, 'gemini-flash-lite-latest');
if ('max_tokens' in prepared || 'max_completion_tokens' in prepared) errors.push('Gemini request must not carry a hard completion cap while thinking');
if (prepared.reasoning_effort !== 'low') errors.push('Gemini request must default to low reasoning effort');
if (prepared.extra_body?.google?.thinking_config) errors.push('Gemini request must not send overlapping thinking config with reasoning_effort');
if (!resilience.streamNeedsGeminiRetry({ finishReason: 'MAX_TOKENS', visibleOutput: false, retried: false })) errors.push('Gemini truncated thinking-only streams must be retryable');
if (!resilience.streamNeedsGeminiRetry({ finishReason: 'MAX_TOKENS', visibleOutput: true, retried: false })) {} else errors.push('Gemini streams with visible output must not be retried');
if (!src.includes("const proxy = !['gemini', 'anthropic'].includes(provider.id)")) errors.push('Gemini must bypass the OpenAI-compatible proxy');
if (!src.includes("const providerType = provider.id === 'gemini' && !antigravity && !geminiProxy ? 'google-genai'")) errors.push('Gemini must use the native google-genai provider type');
if (!src.includes("https://generativelanguage.googleapis.com")) errors.push('Gemini native Google endpoint missing');
if (!src.includes("type = ${tomlQuote(providerType)}")) errors.push('Provider TOML generation missing');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS: disabled-model migration and Gemini catalog exclusion are enforced');
