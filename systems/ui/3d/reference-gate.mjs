const THREE_SIGNAL = /\b(3d|three(?:\.js)?|webgl|webgpu|canvas 3d|gltf|glb|shader|babylon)\b/i;
const EXAMPLE_SIGNAL = /\b(example|demo|reference|inspiration|docs?|showcase|similar|like)\b/i;
const MOBILE_SIGNAL = /\b(mobile|phone|android|ios|tablet|responsive)\b/i;

export function classify3dRequest(prompt = '') {
  const text = String(prompt || '').trim();
  const is3d = THREE_SIGNAL.test(text);
  return Object.freeze({
    is3d,
    referenceRequired: is3d,
    referenceMode: EXAMPLE_SIGNAL.test(text) ? 'named-or-example' : 'working-example',
    mobile: MOBILE_SIGNAL.test(text),
  });
}

export function build3dTaskFrame(prompt = '') {
  const task = classify3dRequest(prompt);
  if (!task.is3d) return '';
  return `[3D] research=mandatory; reference=${task.referenceMode}; verify-api=official/current-docs; extract-patterns=not-clone; performance=draw-calls/triangles/dpr/disposal/mobile; continuous-state=ref-or-animation-loop; reduced-motion=required`;
}

export function build3dSystemPrompt() {
  return [
    '## LazyDev 3D System',
    '3D/WebGL/Three.js work always enters a research gate before code changes. Search for at least one concrete working reference example and verify the API against current official documentation or the exact repository version.',
    'Use the reference to resolve camera, scale, lighting, materials, loaders, interactions, and responsive behavior. Extract principles, do not copy demo chrome or fabricate APIs/assets.',
    'Treat performance as part of correctness: control draw calls and geometry cost, use instancing for repeated meshes when appropriate, consider LOD only when justified, cap DPR for expensive scenes, dispose resources, and avoid per-frame React state updates.',
    'Verify mobile behavior, loading/error/unsupported states, resize handling, reduced motion, and visual framing before adding decorative effects.',
  ].join('\n');
}
