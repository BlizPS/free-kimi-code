# Pro UI Intelligence

A local, dependency-free design intelligence engine for Lazy Developer.

The engine combines product classification, deterministic reasoning, searchable design data, stack detection, design-system synthesis, persistence, and source-quality checks. It is designed to run from both the CLI and plugin/skill environments without adding large UI instructions to every model turn.

## Workflow

`classify → search → reason → synthesize → persist → verify`

Use `lazydev ui "<product and interface brief>" --json` for machine-readable output.

## Data

The bundled catalog is an original compact knowledge base inspired by established design-system workflows: product types, layout patterns, visual styles, semantic palettes, typography pairings, motion presets, component guidance, stack guidance, and UX rules.
