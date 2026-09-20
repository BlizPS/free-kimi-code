import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const py = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
const errors = [];
if (/antigravity-preview(?:-|$)/i.test(src)) errors.push('Legacy disabled Antigravity identifier still present');
if (src.includes('return models.filter((m) => !isAntigravityModel(m.id));')) errors.push('Gemini catalog is still filtering Antigravity models');
if (!py.includes("if provider[\"id\"] not in {\"anthropic\", \"gemini\"} or ui in {\"codex\", \"antigravity\"}:")) errors.push('Gemini/Kimi routing regression');
const resilience = await import('../runtime/gemini-resilience.mjs');
const prepared = resilience.prepareGeminiRequest({ model:'gemini-flash-lite-latest', max_tokens:512, max_completion_tokens:512, reasoning_effort:'low', extra_body:{google:{thinking_config:{thinking_level:'low'}}} }, 'gemini-flash-lite-latest');
if ('max_tokens' in prepared || 'max_completion_tokens' in prepared) errors.push('Gemini request must not carry a hard completion cap while thinking');
if (prepared.reasoning_effort !== 'low') errors.push('Gemini request must default to low reasoning effort');
if (prepared.extra_body?.google?.thinking_config) errors.push('Gemini request must not send overlapping thinking config with reasoning_effort');
if (!resilience.streamNeedsGeminiRetry({ finishReason:'MAX_TOKENS', visibleOutput:false, retried:false })) errors.push('Gemini truncated thinking-only streams must be retryable');
if (resilience.streamNeedsGeminiRetry({ finishReason:'MAX_TOKENS', visibleOutput:true, retried:false })) errors.push('Gemini streams with visible output must not be retried');
if (!src.includes('type = ${tomlQuote(providerType)}')) errors.push('Provider TOML generation missing');
if (!py.includes("env['GOOGLE_GEMINI_BASE_URL']=f'http://127.0.0.1:{proxy.port}'")) errors.push('Antigravity base URL must point at proxy root');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('PASS: Gemini compatibility and Antigravity model routing are enabled');
