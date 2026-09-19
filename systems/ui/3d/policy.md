# 3D Implementation Policy

3D tasks are research-first. Before creating or changing 3D/WebGL/Three.js code, inspect the current project and search for at least one concrete, working reference example. Prefer official Three.js documentation/examples and the exact library version used by the repository. For non-trivial visual work, use both a visual reference and a technical reference.

## Reference gate

- Verify the API/class/example against current documentation before using it.
- Record the source URL or repository path in the implementation notes so later edits can trace the decision.
- Extract interaction, camera, lighting, material, loading, and responsive patterns; do not copy unrelated demo chrome.
- Use real assets or verified local assets; inspect GLB/glTF assets before inventing loaders, nodes, or animations.

## Performance gate

- Keep render work proportional to the target device. Test mobile explicitly.
- Reduce unnecessary draw calls; use instancing for repeated geometry when appropriate.
- Reduce geometry/triangle count before adding expensive post-processing. Use LOD only when scene complexity and viewing distance justify it.
- Cap device pixel ratio for expensive scenes, avoid unbounded canvas resolution, and dispose geometries/materials/textures when scenes are removed.
- Avoid React state updates on every animation frame. Use refs, animation loops, or motion values for continuous values.
- Prefer frustum culling and bounded raycasting; do not raycast or recalculate full scene state every frame without evidence.

## Visual correctness

- Establish camera framing, scale, coordinate conventions, lighting intent, material response, and interaction states before decorative effects.
- Provide loading/error/unsupported-device states when asset or GPU availability can fail.
- Honor `prefers-reduced-motion` and provide a lower-motion path.
