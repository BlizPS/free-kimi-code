# Security

Do not include credentials, private keys, tokens, or other secrets in issues or pull requests.

Skills are instructions that can change agent behavior. Review `SKILL.md`, scripts, references, and manifests before installation, and use the host's normal permission controls for tool execution.

This repository ships no MCP server, hook, binary, or auto-run network service. The bundled verification scripts are static Python checks and are intended to run manually or in CI.

For a suspected security problem, report enough detail to reproduce it without publishing sensitive data. Remove or redact secrets before sharing logs, patches, or screenshots.
