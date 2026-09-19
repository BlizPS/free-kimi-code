# Token Efficiency Reference

Use this reference for long tasks, context-heavy work, or explicit token-saving requirements. Keep the main Skill contract short; load detail on demand.

## 1. Optimize the Session

Optimize total tokens across the task, not only the current reply. A shorter reply that causes another tool call or another user round-trip is not efficient.

## 2. Response Contract

- Lead with the result, decision, blocker, or required action.
- Do not narrate skill activation, tool mechanics, internal reasoning, or a progress diary.
- Remove greetings, praise, repeated prompts, generic summaries, and filler.
- State facts once; point to exact paths, lines, commands, or evidence instead of paraphrasing them again.
- Use the minimum structure that keeps the answer scannable.
- Expand only for risk, ambiguity, required explanation, or explicit user request.

## 3. Tool Economics

- Choose high-information actions first.
- Prefer one targeted read/search over broad repeated reads.
- Reuse already verified evidence.
- Do not rerun an identical failed command without changing the hypothesis or input.
- Stop when acceptance is proven; expand verification only after failure or meaningful untested risk.

## 4. Context Economics

- Keep a compact working set of current requirements, decisions, relevant files, evidence, and unresolved risks.
- Drop duplicate, stale, superseded, and low-value context.
- Preserve exact technical literals and semantic negatives such as `not`, `never`, and `only`.
- Compact history before the context window becomes crowded; preserve goal, constraints, decisions, changes, test results, and open risks.

## 5. Progressive Disclosure

Keep discovery metadata cheap. Put deeper guidance, examples, and edge cases in references. Load a reference only when the active task needs it. Do not import an entire documentation tree into the hot path.

## 6. Output Budgeting

Default to a small response budget for simple tasks. Increase it only for complex implementation, debugging, security, architecture, or when the user asks for explanation. Never truncate required technical content merely to hit a numeric target.

## 7. Code and Artifacts

Do not compress source code, commands, configuration, API payloads, paths, errors, or persisted documentation unless explicitly requested. Keep comments functional. Avoid generated filler, duplicated helpers, speculative abstractions, and verbose placeholder text.

## 8. Model/Agent Handoffs

Subagents should return durable findings, changed files, decisions, and proof—not transcript-sized narration. Pass only the context needed for the subtask. Merge conclusions, not raw exploration logs.

## 9. UI Work

UI tasks often need more implementation detail but not more chatter. Research only the references that can change the design decision. Extract reusable patterns, then implement. Report the resulting UI behavior and concrete verification rather than a design diary.

## 10. Reference Basis

These principles are adapted from public agent-skill patterns emphasizing progressive disclosure, compact context, high-signal output, and isolated subagent contexts:

- https://github.com/denfry/claude-skills/tree/main/skills/token-efficiency
- https://github.com/latestaiagents/agent-skills/tree/main/skills/skills-authoring/progressive-disclosure
- https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents
- https://www.kimi.com/code/docs/en/kimi-code-cli/guides/sessions

Use these as design references, not as runtime dependencies.
