# Architecture

Lazy Developer is a developer layer built around the Kimi Code workflow. The CLI coordinates configuration, model selection, provider routing, capability-aware tool handling, skills, context protection, sessions, browser/search support, and standalone artifacts while using the official Kimi Code, Codex, and Antigravity CLIs as the interactive shells.

## How Lazy Developer Works

```text
                         Lazy Developer
                                │
                                ▼
                           CLI Layer
                          `lazydev`
                                │
                                ▼
                         Kimi Code Shell
                                │
                                ▼
                    Provider / Model Routing
                                │
                  ┌─────────────┴─────────────┐
                  │                           │
                  ▼                           ▼
           Live Model Metadata        Provider Compatibility
                  │                     / Local Proxy
                  └─────────────┬─────────────┘
                                ▼
                     Tool / Capability Bridge
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        Native Tools      Synthetic Tools     Hooks / Guards
              │                 │                 │
              └─────────────────┼─────────────────┘
                                ▼
                             Skills
                                │
                   ┌────────────┼────────────┐
                   ▼            ▼            ▼
               Artifacts     Sessions     Browser
```

The key boundary is simple: **Lazy Developer owns the developer layer and routing; the official Kimi Code, Codex, or Antigravity CLI remains the interactive agent shell.**

## Runtime Flow

A normal `lazydev chat` startup follows this path:

1. Load Lazy Developer configuration.
2. Resolve the selected provider and model.
3. Refresh model metadata when supported.
4. Determine effective context, output, reasoning, and tool capabilities.
5. Prepare provider compatibility and routing when required.
6. Generate the Kimi Code configuration and Lazy Developer runtime instructions.
7. Register the LazyDev search/browser MCP integration.
8. Register lifecycle and tool-boundary hooks.
9. Prepare the artifact routing layer.
10. Start Kimi Code with the selected LazyDev route.
11. Keep routing, tools, skills, context controls, sessions, and artifacts connected to the running agent.

## 1. CLI Layer

The native CLI is the main orchestration layer for Lazy Developer.

Its responsibilities include configuration, provider selection, model discovery, capability refresh, Kimi Code startup, session compatibility, artifact setup, and developer utilities.

Typical entry points include:

```bash
lazydev setup
lazydev chat
lazydev sessions
lazydev skills
lazydev artifact <filename>
lazydev env
lazydev doctor
lazydev version
```

`lazydev setup` discovers the provider and model information available to the current installation instead of relying on a permanent hard-coded provider list.

## 2. Kimi Code Shell

Lazy Developer is designed around Kimi Code rather than implementing a separate agent shell.

At startup, LazyDev prepares the Kimi Code configuration used by the active session. The generated configuration connects the selected model route with the Lazy Developer runtime, skills, hooks, MCP tools, and context controls.

The runtime layer also supplies developer-oriented instructions covering principles such as:

- inspect before changing;
- keep simple tasks simple;
- verify changes before claiming completion;
- preserve useful context;
- use the relevant bundled skill;
- research current facts when the task requires it;
- keep standalone deliverables separate from normal project source.

This keeps the familiar Kimi Code experience while adding the surrounding developer layer.

## 3. Provider and Model Routing

Provider routing is part of Lazy Developer's runtime rather than a fixed model alias layer.

### Live model metadata

Where a provider exposes a model catalog, LazyDev can discover and normalize model information into a common representation.

Relevant metadata may include:

- context limits;
- output limits;
- native tool support;
- reasoning/thinking support;
- supported request parameters;
- input/output capabilities;
- provider-specific capability information;
- pricing or free availability when exposed by the upstream catalog.

This metadata gives the runtime enough information to make routing and request-fitting decisions based on capabilities rather than model names alone.

### Provider compatibility

Some provider routes require protocol or request-shape adaptation. Lazy Developer can place a local compatibility boundary around the selected route when necessary.

That layer can normalize requests, remove unsupported fields, react to upstream compatibility errors, retry appropriate transient failures, and adapt tool-calling behavior without silently replacing the selected model.

The proxy is therefore a **compatibility boundary**, not another model.

## 4. Tool and Capability Bridge

Tool calling is treated as a runtime capability.

### Native tools

When the selected model supports native tool calling, Lazy Developer allows the normal Kimi Code tool flow to use it directly.

### Synthetic tool bridge

When native tool calling is unavailable, the runtime can expose a synthetic tool protocol while keeping the same selected model.

The bridge represents available tools in a compact request format and translates the model's tool requests back into the agent's execution flow.

This avoids an invisible model swap merely because a provider route exposes a different tool interface.

### Capability-aware request fitting

Before sending a request, the runtime can fit content to the effective model budget while preserving the highest-value information, including system instructions, recent turns, useful paths, commands, errors, URLs, decisions, and evidence.

## 5. Context and Token Economy

Context management spans routing, tool output, and session handling.

Lazy Developer uses a combination of:

- token budgeting and estimation;
- reserved context space;
- rolling tool-output pruning;
- relevance-aware archival;
- recent-message protection;
- tool-result compaction;
- local archives for large historical/tool output.

Large outputs can be moved out of the active request while keeping a compact representation of the useful signal. The goal is better use of the model's actual context window, not an artificial fixed reduction of that window.

Lazy Developer also integrates **RTK-powered terminal output reduction** for supported shell workflows, reducing avoidable terminal noise before it reaches the model.

## 6. Hooks and Runtime Guards

Hooks sit between the agent lifecycle and tool execution boundaries.

Conceptually, the hook flow is:

```text
User Prompt
    │
    ▼
Prompt / Context Handling
    │
    ▼
Tool Request
    │
    ├── Research checks
    ├── File/path safeguards
    └── Artifact policy
    │
    ▼
Tool Execution
    │
    ▼
Post-tool handling / audits
```

The hook layer can handle task context, research requirements, artifact routing, and UI-related post-write checks without placing every runtime rule inside the main agent prompt.

### Research gate

Research-sensitive tasks can use a task-scoped gate that records external research evidence before the first qualifying write.

### Artifact router hook

Successful standalone file writes can be passed to the artifact router so deliverables are kept separate from ordinary source files.

### UI audit

HTML work can receive a non-blocking post-write audit for common UI issues.

## 7. Skills

The canonical skills live under:

```text
skills/
```

The bundled core focuses on four reusable engineering workflows:

| Skill | Purpose |
| --- | --- |
| `lazy-developer` | Implementation, refactoring, packaging, UI/UX, 3D, SEO, and shipping workflows |
| `lazy-debug` | Evidence-first debugging and root-cause isolation |
| `lazy-review` | Correctness, security, compatibility, regression, and audit review |
| `lazy-test` | Focused verification for code, UI, runtime, releases, and packaging |

Each skill is self-contained through its `SKILL.md` entry point.

The repository treats `skills/` as the canonical source so the same workflows can be reused across compatible agent environments.

For universal installation:

```bash
npx skills add BlizPS/free-kimi-code --all
```

## 8. Artifacts

Standalone deliverables are handled separately from normal repository source.

The artifact layer:

- detects supported standalone deliverable types;
- checks whether the task indicates a standalone output;
- avoids moving ordinary project source files;
- routes generated deliverables to the canonical artifact location;
- preserves existing files;
- adds a numeric suffix on filename collisions.

For example:

```text
report.html
report1.html
report2.html
```

The CLI also exposes artifact inspection through:

```bash
lazydev artifact
lazydev artifact <filename>
```

## 9. Sessions

Lazy Developer keeps Kimi Code sessions compatible when provider or model routes change.

The runtime maintains normalized `lazydev/<model>` route information and can preserve compatibility with historical session model references rather than requiring every existing session to use only the newest model route.

Conceptually:

```text
Current session route
        │
        ├── current `lazydev/<model>` route
        │
        └── compatible historical route aliases
```

Session management remains part of the Kimi Code workflow and is surfaced through:

```bash
lazydev sessions
```

## 10. Browser and Search

Lazy Developer exposes browser and web-search capability through its MCP integration.

The browser/search layer is designed to be resilient around malformed arguments, temporary search failures, redirects, and large responses.

### Search fallback

The search layer can try alternate public search sources when one source is unavailable and can use short-lived caching to reduce repeated requests during a session.

### URL safety

Browser fetches validate their destination before requesting it. Local and private network destinations are restricted by default, and redirects and response sizes are bounded.

A browser/search failure is handled as a recoverable tool result when possible rather than being allowed to become an MCP transport failure.

## 11. Platform Abstraction

Platform-specific behavior is isolated behind the runtime's platform abstraction instead of being duplicated throughout the CLI and routing layers.

The higher-level architecture remains shared across supported environments while configuration, executable discovery, and filesystem locations are resolved through the platform layer.

## 12. Repository Map

```text
cli/            LazyDev CLI and orchestration
runtime/        Routing, context, browser/search, artifacts, platform/runtime logic
hooks/          Prompt handling and tool/lifecycle guards
skills/         Canonical portable skills
agents/         Agent-facing compatibility content
commands/       Command and integration definitions
systems/        Domain systems, mechanics, and evaluation content
scripts/        Validation, smoke tests, audits, and maintenance helpers
tests/          Runtime and integration coverage
assets/         Project and documentation assets
```

Root-level integration metadata connects Lazy Developer with compatible agent and plugin ecosystems while keeping the canonical skill implementation in one place.

## 13. Design Principles

### Keep the agent shell familiar

Kimi Code remains responsible for the interactive agent experience. Lazy Developer adds the developer layer around it instead of replacing it.

### Route by capability

Provider and model behavior should be determined from live metadata and runtime evidence whenever possible. A model ID alone is not a complete capability description.

### Preserve the selected model

When a capability is missing, adapt the route where possible instead of silently switching to a different model.

### Keep context useful

Recent, relevant, high-signal information stays in the active request while oversized historical or tool material can be compacted or archived.

### Separate source from deliverables

Normal project files stay in the project workspace. Standalone outputs are routed separately so generated artifacts do not clutter source trees.

### Keep skills portable

Canonical skills are maintained once and reused across compatible agent environments.

### Verify before claiming success

The workflow favors the smallest meaningful change followed by the smallest meaningful proof, with the actual verification result reported back to the user.

## Development

Start from the repository source:

```bash
git clone https://github.com/BlizPS/free-kimi-code.git
cd free-kimi-code
```

The repository source is the ultimate reference for implementation details. This document describes the architecture without treating provider counts, model rosters, or external service inventories as permanent.

## 6. Cross-UI Data and Path Policy

LazyDev keeps two concepts separate:

- **Workspace/artifacts:** the predictable user-home `lazydevfile` directory on Windows, Linux, and macOS; `/storage/emulated/0/lazydevfile` only for native Termux and Debian/Ubuntu running through PRoot.
- **Native CLI data:** each official CLI keeps its application data in its normal user-home location. Kimi uses its Kimi home, Codex uses `CODEX_HOME` (defaulting to `~/.codex`), and Antigravity uses `~/.gemini/antigravity-cli`. On Termux/PRoot, only Codex `CODEX_HOME` gets a native-Linux compatibility location when required by filesystem limitations.

Generic cross-tool Skills live at `~/.agents/skills`, which Kimi and Codex can share directly and Antigravity can consume through its native global Skills path.
