# Document Hygiene

Use only for content/files the user is authorized to modify. This path is for metadata and formatting hygiene, not authorship claims and not detector-score manipulation.

**classify → inspect → clean → re-inspect → report**

Prefer local deterministic tools and repository formatters. Preserve facts, numbers, names, stable identifiers, structure, and meaning. Do not rename public identifiers or rewrite prose merely to change how an AI detector scores it. Keep originals unless an in-place edit is explicitly requested.

For text: normalize accidental Unicode/control characters and metadata only when clearly unrelated to meaning. For documents/media: remove only explicitly supported metadata fields and preserve content bytes otherwise. Never claim cleanup proves human authorship or guarantees any detector result.

Report concrete before/after changes, skipped fields, and tool limitations.
