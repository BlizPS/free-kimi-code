# Context Policy

Treat context as a ranked working set, not a transcript to repeat.

Keep:
- the latest user intent and explicit constraints;
- repository facts that affect the current change;
- decisions already made;
- exact failure evidence and validation results;
- changed files and unresolved risks.

Drop or collapse:
- greetings, praise, repeated explanations, stale exploration output, duplicate errors, and already-settled alternatives.

Pin recent user requirements, exact literals, and verification evidence. Prefer deterministic selection and preserve source order for ties.
