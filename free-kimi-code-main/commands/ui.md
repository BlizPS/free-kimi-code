# UI Design System

Generate a concrete UI design system before implementing UI.

Use the local design-intelligence engine first:

```bash
lazydev ui "<product type> <audience> <interface> <visual constraints>" --json
```

The result provides the product classification, layout pattern, visual style, semantic color roles, typography, density, motion, UX rules, responsive expectations, and anti-patterns.

For a persistent project system:

```bash
lazydev ui "<brief>" --persist --project "MyApp"
```

For a page override:

```bash
lazydev ui "<page brief>" --persist --project "MyApp" --page "dashboard"
```

For named external products or visual references, research the current reference separately before implementation.
