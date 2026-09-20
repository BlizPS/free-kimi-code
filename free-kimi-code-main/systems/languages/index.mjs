import { detectLanguages, detectPrimaryLanguage } from './detect.mjs';
import { buildTypeScriptFrame, getTypeScriptCommands } from './typescript/index.mjs';
import { buildGoFrame, getGoCommands } from './golang/index.mjs';

const ADAPTERS = Object.freeze({
  typescript: { id: 'typescript', buildFrame: buildTypeScriptFrame, commands: getTypeScriptCommands },
  go: { id: 'go', buildFrame: buildGoFrame, commands: getGoCommands },
});

export function buildLanguageFrame({ cwd = process.cwd(), primary = null } = {}) {
  const detected = detectLanguages(cwd);
  const selected = primary || detected[0]?.id;
  const adapter = ADAPTERS[selected];
  if (!adapter) return `[LANG] detected=${detected.length ? detected.map((x) => x.id).join(',') : 'unknown'}; no dedicated language contract`;
  const evidence = detected.find((x) => x.id === selected)?.evidence?.join(',') || 'argument';
  return `${adapter.buildFrame()} evidence=${evidence}; detected=${detected.map((x) => x.id).join(',')}`;
}

export function getLanguageReport(cwd = process.cwd()) {
  const detected = detectLanguages(cwd);
  return {
    cwd,
    languages: detected,
    primary: detected[0] || { id: 'unknown', confidence: 0, evidence: [] },
    contracts: detected.map((item) => ({ id: item.id, commands: ADAPTERS[item.id]?.commands?.() || {} })),
  };
}

export { detectLanguages, detectPrimaryLanguage };
