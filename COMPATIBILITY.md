# Compatibility

Lazy Developer has two sides: the built-in CLI experience and a portable skills/plugin layer.

## LazyDev CLI

The built-in chat flow uses Kimi Code as its agent shell. Configure the provider, API key, and model with `lazydev setup`, then start with `lazydev chat`.

Supported managed providers: Gemini, OpenRouter, NVIDIA, Anthropic, and OpenAI.

## Other coding agents

Use the universal Skills CLI when you want Lazy Developer's skills inside another compatible agent:

```bash
npx skills add BlizPS/lazy-developer-skill-cli --all
```

For a specific target supported by the Skills CLI:

```bash
npx skills add BlizPS/lazy-developer-skill-cli --agent claude-code
```

LazyDev itself already bundles its own skills, so this universal install is for other agents, not for `lazydev chat`.

## Plugins and extensions

Native integration metadata is included for compatible coding-agent ecosystems. Use each host's normal plugin or extension installation flow.

## Platforms

Lazy Developer runtime paths include Windows, Linux, macOS, and Termux. The one-line desktop installer targets macOS/Linux/Windows because Kimi Code's current native installer does not provide an Android/Termux path.
