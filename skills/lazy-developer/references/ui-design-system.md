# UI Design Intelligence

Activate for UI/UX, visual polish, responsive layout, animation, dashboards, components, landing pages, mobile UI, or 3D. Treat the task as a **design-system problem**, not a pile of pretty screens.

## Intelligent Design System Generation
Use **CLASSIFY → SYSTEMIZE → IMPLEMENT → STRESS → POLISH**.

1. **Classify:** infer product/domain, users, platform, stack, content density, brand mood, accessibility needs, motion budget, performance budget, and existing product identity.
2. **Systemize:** choose a compact, coherent **pattern + visual language + semantic color roles + type scale + spacing/radius + surfaces/elevation + icon language + component states + responsive rules + motion rules + anti-patterns**.
3. **Implement:** make pages inherit the same system. Prefer existing tokens/components. If none exist, create a small semantic token set instead of many one-off values.
4. **Stress:** test narrow/wide layouts, long text/locales, loading/empty/error states, focus/touch, reduced motion, and heavy assets.
5. **Polish:** fix the first visible or functional mismatch. Do not cover weak hierarchy with decoration.

## Pro UI/UX mode
Match the visual system to the product, not to whatever trend is popular. Commit to one dominant family; depth, texture, borders, blur, gradients, and illustration are supporting tools, not defaults. Avoid generic AI-looking purple/pink gradients, excessive glass, giant rounded cards, random shadows, decorative icons, and animation without purpose unless the brand or brief explicitly calls for them.

Hierarchy beats decoration: one primary action, clear grouping, readable density, deliberate whitespace, and stable visual rhythm. Use semantic states and never make color the only state cue. Headings, chips, badges, URLs, IDs, tables, and controls must survive natural wrapping, text scaling, zoom, and touch/keyboard use.

Choose type for the product and locale; keep readable sizes/line-height and a deliberate heading/body relationship. Define useful states: default, hover, focus, pressed, disabled, loading, success, and error where relevant. Motion should explain continuity or provide feedback, remain interruptible, respect `prefers-reduced-motion`, and never block the final semantic state.

## 3D-viz mode
When 3D is requested, first decide whether 3D improves comprehension or atmosphere. Choose the lightest suitable method: **CSS depth → SVG/canvas → WebGL/Three.js/R3F → native 3D API**. Define camera, lighting, materials, depth hierarchy, interaction, loading/fallback, and mobile performance before building. Keep most controls/content in 2D unless spatial interaction is the product need. Avoid heavy scenes, gratuitous particles, endless camera motion, and depth that hurts readability.

## Design-system output
Keep the internal system compact: **Target → Pattern → Style → Color roles → Type → Components → Motion → Responsive → Anti-patterns**. Retrieve only the design facts needed for the current product/stack; do not dump a giant style catalog into context.

## Delivery gate
Before shipping inspect: hierarchy, consistency, responsive behavior, text reflow, empty/loading/error states, keyboard/focus semantics, contrast, reduced motion, touch targets, asset weight, and runtime performance. When a preview/runtime exists, visually inspect it. Fix mismatches instead of adding decoration.
