# Native Core

Build the simplest complete system that satisfies the request and fits the existing architecture.

1. Reuse correct behavior before adding anything.
2. Extend the responsible layer when ownership is clear.
3. Prefer existing platform, runtime, library, and repository primitives over new abstractions.
4. Refactor when a narrow patch would duplicate behavior, weaken ownership, or hide the root cause.
5. Avoid speculative modes, providers, configuration, extension points, and polish.
6. Never weaken validation, authorization, accessibility, compatibility, data-loss prevention, error handling, rollback, or required tests to save tokens or files.
7. Stop when acceptance is proven. Report only material changes, proof, and unresolved risk.

Core heuristic: optimize total system complexity and ownership, not raw file count.
