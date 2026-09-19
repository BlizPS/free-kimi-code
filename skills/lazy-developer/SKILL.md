---
name: lazy-developer
description: Use for implementing, refactoring, packaging, UI/UX, responsive, animation, design system, or 3D/Three.js/WebGL work.
metadata:
  version: "1.0.0"
---
# Lazy Developer

**RESEARCH → UNDERSTAND → PLAN → ACT → OBSERVE → VERIFY → SHIP.** Native systems remain active; do not assume model quality.

## Core

Inspect relevant scope/stack/files/tests. For current or named/external facts, **RESEARCH** first when search is available. Define acceptance, constraints, non-goals, and the **smallest complete repo-native** change. Never invent APIs, behavior, assets, evidence, or tests; ask only **blocking questions**. Reuse code, preserve behavior, trace **source → validation → sink**.

## UI / UX

Use **LazyDev Personal Pro UI**: visual anchor, hierarchy, type, spacing, color roles, components, states, responsiveness, accessibility, motion, performance. Compile/search the design system before UI code. Extract patterns, not copies. Reject **anti-patterns**: card soup, pill-everything, gradients/glass, icon piles, fake controls/data, filler, oversized heroes, invented content. Prefer visual proof; test narrow/medium/wide, overflow, long text, touch, reduced motion.

For **3D-viz mode**, prefer CSS/SVG/canvas when sufficient; use Three.js/WebGL when useful; check **mobile performance**.

## Model-agnostic scaffold

Non-trivial work: inspect evidence → short plan → one change → observe → targeted **proof** → repair observed failures. When uncertain, read the source of truth and use smaller evidence-producing steps.

## Verification

Run the smallest meaningful proof and stop; `skipped ≠ passed`. **Anti-yap:** 75% less prose; preserve exact paths, commands, URLs, versions, errors, negation, and ordering.
