const COMMANDS = Object.freeze({
  format: 'gofmt -w <changed-go-files>',
  tests: 'go test ./...',
  vet: 'go vet ./...',
  build: 'go build ./...',
});

export const GO_RULES = Object.freeze([
  'Run gofmt on changed Go files; formatting is part of correctness.',
  'Preserve module and package boundaries declared by go.mod.',
  'Prefer small interfaces defined at the consumer boundary.',
  'Handle returned errors deliberately; do not discard them without a documented reason.',
  'Avoid goroutines without clear ownership, cancellation, and lifetime.',
  'Prefer context.Context propagation at I/O and request boundaries.',
  'Do not edit generated files unless regeneration is part of the task.',
  'Use go test ./... and go vet ./... before claiming a multi-file Go change is complete.',
]);

export function buildGoFrame() {
  return `[LANG:go] format=gofmt; tests=go test ./...; vet=go vet ./...; build=go build ./...; rules=${GO_RULES.join(' ')}`;
}

export function getGoCommands() { return { ...COMMANDS }; }
