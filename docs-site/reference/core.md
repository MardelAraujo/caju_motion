---
title: '@caju-motion/core'
description: API reference for the Caju Motion animation runtime - useFrame, useVideoConfig, Sequence, Fill, interpolate, spring, Easing, cubicBezier, random, delayRender, keyframes and color helpers.
---

# `@caju-motion/core`

The deterministic animation runtime used by the renderer and by your [components](../guide/components). Everything here is a pure function of the frame.

```ts
import { useFrame, useVideoConfig, Sequence, Fill, interpolate, spring, Easing, random } from '@caju-motion/core';
```

## Frame hooks

| API | Returns |
|---|---|
| `useFrame()` | current frame relative to the clip (or the enclosing `<Sequence>`) |
| `useAbsoluteFrame()` | absolute project frame (ignores `<Sequence>`) |
| `useVideoConfig()` | `{ width, height, fps, durationInFrames }` |

Hooks must run inside the renderer (`FrameProvider`); outside it they throw.

## `<Sequence>` and `<Fill>`

```tsx
<Sequence from={30} duration={60}>
  <Title />  {/* mounted on frames 30–89; useFrame() starts at 0 */}
</Sequence>
```

- `Sequence({ from, duration? })` mounts children only on `[from, from + duration)` and shifts the frame to start at 0. Sequences nest. With `duration`, `useVideoConfig().durationInFrames` becomes that duration.
- `Fill({ style?, children? })` is an absolutely positioned full-box `div` (`inset: 0`), the base of any layer.

## `interpolate`

```ts
interpolate(input, inputRange, outputRange, { easing?, extrapolateLeft?, extrapolateRight? }): number
```

- Piecewise linear mapping; `inputRange` must be strictly increasing and the same length as `outputRange` (≥ 2).
- Extrapolation: `'clamp'` (**default** on both ends), `'extend'` or `'identity'`.
- `easing` applies inside each segment.

```ts
const x = interpolate(frame, [0, 20, 40], [0, 300, 250], { easing: Easing.easeInOut });
```

Helpers: `progress(frame, from, to, easing?)` → 0..1 clamped; `lerp(a, b, t)`.

## `spring`

```ts
spring({ frame, fps, config?, from = 0, to = 1, delay = 0 }): number
```

An **analytic** damped spring (closed-form, not simulated), so the value at frame N is a pure function of N: seekable and deterministic.

| `config` | Default (`ui`) |
|---|---|
| `mass` | 1 |
| `stiffness` | 170 |
| `damping` | 26 |
| `overshootClamping` | false |

Presets: `springPresets.ui` (fast, almost no overshoot), `settle` (smooth, no bounce), `bouncy` (visible bounce), `heavy` (slow and heavy).

```ts
const s = spring({ frame, fps, config: springPresets.bouncy, delay: 10 });
```

`springDuration({ fps, config?, threshold = 0.005, maxFrames = 600 })` returns the frames until the spring settles.

## Easing

| API | Notes |
|---|---|
| `Easing.linear`, `hold`, `easeIn`, `easeOut`, `easeInOut`, `expoOut`, `expoInOut`, `softOut`, `backOut` | same presets as keyframes |
| `cubicBezier(x1, y1, x2, y2)` | like CSS `cubic-bezier`; `x1`/`x2` in [0, 1] |
| `resolveEasing(spec)` | turns a document easing (`'expoOut'` or `{ bezier: [...] }`) into a function |

## Deterministic randomness

| API | Returns |
|---|---|
| `random(seed)` | number in [0, 1); same seed → same number on any machine |
| `randomRange(seed, min, max)` | number in [min, max) |

Use a seed that is stable per element, e.g. `random(id + '-' + i)`. Never `Math.random()`.

## `delayRender`

```ts
const handle = delayRender('loading chart data');
fetchOnce().then((data) => { cache = data; continueRender(handle); });
```

The exporter captures a frame only when every open handle is closed. In the preview it is informational. Advanced: `createRenderGate()` and the global `renderGate` (`delayRender`, `continueRender`, `pending()`, `ready()`).

## Keyframes and colors

Used by the renderer; handy in custom tools.

| API | Notes |
|---|---|
| `evaluateKeyframes(keyframes, localFrame)` | value of a keyframe track at a clip-local frame |
| `clipValue(clip, path, projectFrame, fallback)` | a clip property with keyframes applied |
| `isClipActive(clip, projectFrame)` | `start <= frame < start + duration` |
| `getByPath(obj, 'a.b.c')` | nested property access |
| `isHexColor`, `parseHex`, `toHex`, `mixColors(from, to, t)` | `#rgb`, `#rrggbb`, `#rrggbbaa` |
