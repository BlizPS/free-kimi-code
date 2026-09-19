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
