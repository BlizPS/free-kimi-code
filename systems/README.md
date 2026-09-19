# LazyDev Systems

Built-in runtime systems that improve agent execution without requiring a user-activated Skill.

## Design

- `core/` defines architecture-first execution and scope discipline.
- `token/` defines deterministic token economy and progressive disclosure.
- `context/` keeps working context small while preserving high-value evidence.
- `workflows/` defines investigate-first, lean-build, and verify-and-stop behavior.
- `ui/` defines the UI generation loop and anti-slop constraints.
- `evals/` contains lightweight contracts for the built-in systems.

Detailed files are source material. The CLI compiles only compact runtime rules into the agent system prompt so the repository can be rich without making every turn expensive.


## Built-in domain systems

- `ui/taste/` contains the licensed Taste core and a progressive-disclosure compiler. It is a system source, not a discoverable Skill.
- `ui/3d/` enforces working-example research, API verification, and performance gates for 3D/WebGL work.
- `seo/` provides current-guidance-aware SEO rules and source auditing for metadata, crawlability, indexing, structured data, and performance.

The user-facing Skill set remains exactly four: `lazy-developer`, `lazy-debug`, `lazy-review`, and `lazy-test`.
