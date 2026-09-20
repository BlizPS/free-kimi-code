# Language Systems

LazyDev language systems provide compact, host-neutral coding contracts for languages that need stronger verification and implementation guidance.

Supported dedicated profiles:

- TypeScript: type checking, formatting, module contracts, input narrowing, async correctness.
- Go: gofmt, tests, vet, build, error handling, package boundaries, and concurrency ownership.

The JavaScript runtime detects the active project language and injects only the relevant compact frame into the CLI/agent execution context. The TypeScript and Go source profiles remain reference implementations for host integrations that compile or statically consume them.
