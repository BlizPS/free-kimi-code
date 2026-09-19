const COMMANDS = Object.freeze({
  format: 'npx prettier --check .',
  typecheck: 'npx tsc --noEmit',
  tests: 'npm test',
});

export const TYPESCRIPT_RULES = Object.freeze([
  'Preserve tsconfig intent; do not weaken strictness just to silence errors.',
  'Prefer precise types and narrowing over broad any or unsafe assertions.',
  'Keep public API types explicit when they cross module boundaries.',
  'Prefer existing project utilities, path aliases, and module conventions over new abstractions.',
  'Use unknown for untrusted values and validate before use.',
  'Keep async boundaries explicit and avoid unhandled promises.',
  'Do not rewrite generated files or lockfiles unless the task requires it.',
]);

export function buildTypeScriptFrame() {
  return `[LANG:typescript] typecheck=tsc --noEmit; format=prettier --check; tests=npm test; rules=${TYPESCRIPT_RULES.join(' ')}`;
}

export function getTypeScriptCommands() { return { ...COMMANDS }; }
