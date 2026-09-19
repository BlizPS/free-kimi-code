# Token System

The shared token system is a host-neutral runtime layer for Lazy Developer. CLI hosts can execute the ESM modules directly. Skill hosts can consume the progressive-disclosure contract through `SKILL.md`. Plugin hosts can load the compact directive and use host hooks when execution hooks are available.

## Layers

1. Budgeting reserves output space and triggers compaction before context exhaustion.
2. Selection keeps task-relevant blocks and pinned evidence.
3. Compaction preserves code, paths, URLs, identifiers, versions, errors, and negation.
4. Observation control shrinks repeated or low-signal tool output.
5. Deduplication prevents repeated tool requests and repeated context.
6. Handoffs return durable findings instead of transcripts.
7. Metrics provide local session accounting without changing provider routing.
8. Host adapters keep the same policy portable across CLI, skills, and plugins.

The system does not modify provider authentication, model routing, RFK behavior, or version metadata.
