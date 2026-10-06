---
title: Animation
description: Keyframes and easing in Caju Motion - property paths, easing presets, custom bezier curves, entrance/exit recipes and keeping project.json small.
---

# Animation

Two ways to animate:

- **Keyframes** on any clip, stored in `project.json` (this page). Written by `video.ts` or by hand; they play back in the Studio.
- **Code** inside a [component](./components) with `interpolate` / `spring`, driven by `useFrame()`.

## Keyframes

```json
"keyframes": {
  "opacity":     [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 18, "value": 1 }],
  "transform.y": [{ "frame": 0, "value": 1000, "easing": "softOut" }, { "frame": 18, "value": 960 }],
  "props.color": [{ "frame": 30, "value": "#FFFFFF", "easing": "easeInOut" }, { "frame": 45, "value": "#F6B73C" }]
}
```

- Keys are property paths: `opacity`, `transform.x|y|scale|rotation`, `props.<name>`.
- `frame` is an integer **relative to the clip start**, `< duration`.
- `easing` sits on the keyframe where a segment **starts**: it shapes the movement to the next keyframe. The last keyframe's easing is unused.
- Before the first keyframe the value holds at the first value; after the last, at the last.
- Numbers interpolate, hex colors blend, other strings step (e.g. `props.text`).
- When a path has keyframes, they override the static value while the clip plays.

In `video.ts`, `enter`/`exit` generate these for you, and `kf` adds more (frames relative to the scene):

```ts
s.rect(400, 8, { fill: '#F6B73C' }, {
  id: 'line', x: 340, y: 700, anchorX: 0,
  kf: { 'props.width': [[0, 0, 'easeInOut'], [30, 400]] },
});
```

## Easing presets

| Preset | Use for |
|---|---|
| `softOut` | default entrance (gentle decelerate) |
| `expoOut` | snappy entrance, big moves |
| `backOut` | pops and scale-ins (slight overshoot) |
| `easeInOut` | moves between two on-screen positions |
| `easeIn` | exits |
| `easeOut` | general deceleration |
| `expoInOut` | dramatic transitions |
| `linear` | constant motion (tickers, progress bars) |
| `hold` | jump to the next value at the next keyframe (blinks, step counters) |

Custom curve, same as CSS `cubic-bezier`: `"easing": { "bezier": [0.22, 1, 0.36, 1] }`.

## Recipes (30 fps)

| Effect | Recipe |
|---|---|
| Fade + rise in | opacity 0 → 1 and y +16…+40 → y over 15–24 frames, `softOut` |
| Pop in | scale 0.6 → 1 over 12–18 frames, `backOut`, plus an opacity fade |
| Slide in | x ± 80–200 → x, 18–24 frames, `expoOut` |
| Exit | opacity 1 → 0 over the last 8–16 frames, `easeIn`; the last keyframe at `duration - 1` |
| Line reveal | `props.width` 0 → W, 20–35 frames, `easeInOut`, with `anchorX: 0` so it grows to the right |
| Stagger | start each item's clip 3–6 frames after the previous one |
| Ken Burns | scale 1 → 1.12, `linear`, across the whole clip |

## Keep the JSON small

- Use **2–4 keyframes per property** with easing presets. Don't bake every frame: it bloats the file and makes Studio editing impossible.
- Hold a value by duplicating a keyframe (`frame: 125, value: 1, easing: "easeIn"` → `frame: 137, value: 0`) instead of adding intermediate frames.

## In code: `interpolate` and `spring`

```tsx
import { Easing, interpolate, spring, useFrame, useVideoConfig } from '@caju-motion/core';

const frame = useFrame();
const { fps } = useVideoConfig();
const opacity = interpolate(frame, [0, 15], [0, 1], { easing: Easing.softOut }); // clamps by default
const scale = spring({ frame, fps, config: { damping: 12 }, from: 0.6, to: 1 });  // analytic, seekable
```

The same easing presets are available as `Easing.<name>`. Full API: [@caju-motion/core](../reference/core).

::: info Studio and keyframes
The Studio plays keyframes back but can't edit them yet (a timeline keyframe editor is planned). Dragging an element offsets all its position keyframes. Write animation in code; let humans polish placement, copy and timing.
:::
