---
name: caju-components
description: Write deterministic, frame-driven React code for Caju Motion with the core runtime (useFrame, useVideoConfig, Sequence, Fill, interpolate, spring, Easing, random, delayRender). Use when building custom animated components, contributing to the Caju renderer, or when the user asks for effects that keyframes cannot express.
version: 0.1.0
---

# Caju components (frame-driven React)

## Availability (v0.1.0): read first
- **Custom component clips are not rendered yet.** A clip with `type: "component"` draws nothing today; `defineComponent` and the Studio "Componentes" tab arrive in F2.
- Today, this skill applies to:
  1. contributing to `packages/renderer` / `packages/core`;
  2. prototyping components to ship in F2.
- For user videos **today**, express the effect with keyframes (caju-authoring → animation.md) or pre-render it as SVG/PNG/video assets (caju-assets).
- Import from `@caju-motion/core`.

## Runtime API (`@caju-motion/core`)
```tsx caju-check
import { Fill, Sequence, interpolate, spring, springPresets, Easing, random, useFrame, useVideoConfig } from '@caju-motion/core';

export function Title({ text }: { text: string }) {
  const frame = useFrame();                  // frame relative to the enclosing <Sequence>
  const { fps, width } = useVideoConfig();   // width, height, fps, durationInFrames
  const enter = spring({ frame, fps, config: springPresets.settle });
  const y = interpolate(frame, [0, 20], [40, 0], { easing: Easing.softOut }); // clamps by default
  const jitter = (random(`${text}-x`) - 0.5) * 4;                             // deterministic "random"
  return (
    <Fill style={{ display: 'grid', placeItems: 'center' }}>
      <h1 style={{ opacity: enter, transform: `translate(${jitter}px, ${y}px)`, maxWidth: width * 0.8 }}>{text}</h1>
      {/* children of a Sequence see frame 0 at absolute frame 30 */}
      <Sequence from={30} duration={60}>
        <Fill style={{ borderBottom: '4px solid #F6B73C' }} />
      </Sequence>
    </Fill>
  );
}
```
| API | Notes |
|---|---|
| `useFrame()` / `useAbsoluteFrame()` | Relative to the current `<Sequence>` / absolute in the project |
| `useVideoConfig()` | `{ width, height, fps, durationInFrames }` (the duration is the sequence's when one is set) |
| `<Sequence from duration?>` | Mounts children only within the window; nested sequences compose |
| `<Fill style>` | Absolute full-frame layer |
| `interpolate(x, inRange, outRange, { easing, extrapolateLeft/Right })` | Ranges must be ascending and the same length; default extrapolation is `clamp` |
| `spring({ frame, fps, config, from, to, delay })` | Analytic, so it is seekable; presets `ui`, `settle`, `bouncy`, `heavy`; `springDuration()` |
| `Easing.*`, `cubicBezier()` | Same presets as keyframes |
| `random(seed)`, `randomRange(seed, min, max)` | Deterministic, from a string or number seed |
| `mixColors(a, b, t)` | Hex color blend |
| `delayRender(label)` / `continueRender(handle)` | Hold the frame capture until async data, fonts or images are ready (wired into export in F1) |

## Rules
See [determinism.md](determinism.md).
- The render is a pure function of the frame: no clock, no randomness, no timers, no CSS animations, no state that accumulates across frames.
- Size everything from `useVideoConfig()`. Never assume 1920×1080.
- Every async resource must be wrapped in `delayRender`/`continueRender`, and load it once (module cache), not per frame.
- Run `npm run lint` (determinism) and `npm run test` before handing over.
