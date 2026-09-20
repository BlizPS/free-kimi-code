export const typescriptProfile = {
  id: 'typescript',
  compiler: 'tsc',
  checks: ['tsc --noEmit', 'prettier --check .', 'npm test'],
  rules: [
    'Preserve tsconfig strictness.',
    'Prefer precise narrowing over any.',
    'Validate unknown input before use.',
    'Keep public module contracts explicit.',
  ],
} as const;
