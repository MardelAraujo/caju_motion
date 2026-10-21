---
title: Animation
description: Animation in Caju Motion - keyframes and easing, plus motion presets (transitions, entrance/exit/loop animations, effects, overlay and adjustment clips) and the lint warnings of caju check.
---

# Animation

Three ways to animate:

- **Keyframes** on any clip, stored in `project.json`. Written by `video.ts` or by hand; they play back in the Studio.
- **Motion presets**: transitions, entrance/exit/loop animations, effects, overlays and adjustment layers, by name ([below](#motion-presets)).
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

## Motion presets

Named presets the renderer draws for you, in the Studio preview and in the export. Less JSON than keyframes, and each one is a single field. They work on any visual clip and stack with keyframes.

Run `caju catalog --query "<look>"` to search what exists (poses, loops, effects, overlays, your components, templates).

### Entrances and exits

`transitionIn` / `transitionOut` and `animationIn` / `animationOut` use the same **poses**. The entrance plays over the first `duration` frames; the exit over the last ones, and it is the entrance **mirrored**: it leaves by the same side, with the easing mirrored in time (an entrance that decelerates becomes an exit that accelerates).

| Pose | Look | Params (default) |
|---|---|---|
| `fade` | opacity 0 → 1 | — |
| `slide` | moves in from a side | `direction` `left`\|`right`\|`up`\|`down` (`left`), `distance` px (`0` = whole frame) |
| `rise` / `drop` | moves up / down into place, with a fade | `distance` px (80) |
| `zoom` | scale `from` → 1, with a fade | `from` (0.6) |
| `pop` | scale 0.4 → 1 with overshoot | — |
| `blur` | blur → 0, with a fade | `amount` px (24) |
| `spin` | rotate → 0 while scaling up | `degrees` (-90) |
| `wipe` | clip-path reveal from one side | `direction` (`left`) |
| `iris` | circle reveal from the center | — |

Aliases: `push` → slide, `dissolve`/`crossfade`/`fade-in` → fade, `fade-up` → rise, `fade-down` → drop, `scale`/`zoom-in`/`scale-in` → zoom, `reveal` → wipe.

```json
"transitionIn":  { "type": "slide", "duration": 15, "easing": "expoOut", "params": { "direction": "right" } },
"transitionOut": { "type": "fade", "duration": 10 },
"animationIn":   { "preset": "rise", "duration": 18, "params": { "distance": 60 } }
```

- Transitions take an optional `easing`; animations take an optional `params.easing`. Without one, both use the pose's own easing (`expoOut` for slide/rise/zoom, `backOut` for pop).
- Keep entrance + exit ≤ the clip's duration (`caju check` warns with `CAJU_MOTION_OVERLAP`).
- **Transitions don't overlap clips.** Clips on one track can't overlap, so each clip animates itself. For a true crossfade or push, put the incoming clip on an overlay track above, starting as many frames before the cut as its `transitionIn` lasts.

### Loops

`animationLoop` runs while the clip plays. `duration` is the **period** in frames; `params.amplitude` scales it (default 1).

| Loop | At amplitude 1 |
|---|---|
| `pulse` | scale ±6 % |
| `float` | y ±12 px |
| `wiggle` | rotation ±4° |
| `breathe` | opacity dips to 75 % |
| `spin` | one full turn per period |

```json
"animationLoop": { "preset": "float", "duration": 90, "params": { "amplitude": 0.8 } }
```

### Effects

`effects[]` are CSS filters on the clip, applied in order. Each param can be animated with keyframes on `effects.<id>.<param>`.

| Effect | Params (default) |
|---|---|
| `blur` | `radius` px (8) |
| `brightness`, `contrast`, `saturate` | `amount` (1.2, 1.2, 1.4) |
| `grayscale`, `sepia`, `invert` | `amount` 0–1 (1, 0.8, 1) |
| `hueRotate` | `degrees` (90) |
| `dropShadow` | `x` (0), `y` (12), `blur` (24), `color` (`#00000080`) |

```json
"effects": [{ "id": "logo-fx1", "type": "dropShadow", "params": { "y": 16, "blur": 32 } }],
"keyframes": { "effects.logo-fx1.blur": [{ "frame": 0, "value": 0 }, { "frame": 20, "value": 32 }] }
```

### Overlay clips and adjustment layers

- **`type: "effect"`**: a full-frame overlay chosen by `props.effect`, with its params in `props` (keyframable as `props.<name>`):

  | `props.effect` | Params (default) |
  |---|---|
  | `vignette` | `amount` (0.6), `color` (`#000000`) |
  | `letterbox` | `ratio` (2.39), `color` (`#000000`) |
  | `colorOverlay` | `color` (`#F47B35`), `opacity` (0.25) |
  | `flash` | `color` (`#FFFFFF`): full at the clip start, fading to 0 by its end |
  | `grain` | `amount` (0.12), deterministic per frame |

- **`type: "adjustment"`**: applies its `effects[]` to every layer **below** its track, including the project background, while it is active. Titles on tracks above it are not affected.

### In `video.ts`

```ts
s.text('Hello', { size: 120, weight: 800 }, {
  id: 'title', x: 960, y: 540, exit: false,
  animIn: { type: 'rise', dur: 18, params: { distance: 40 } },
  animOut: { type: 'slide', dur: 10, params: { direction: 'left', distance: 200 } },
});
s.image('logo', 600, 180, {
  id: 'logo', x: 960, y: 820,
  transitionIn: { type: 'zoom', dur: 15, easing: 'expoOut', params: { from: 0.85 } },
  loop: { type: 'float', dur: 90, amplitude: 0.5 },
  effects: [{ type: 'dropShadow', params: { y: 16, blur: 32 } }],
});
s.adjust([{ type: 'grayscale', params: { amount: 1 } }], { id: 'flashback' }); // filters the layers declared before it
s.overlay('vignette', { amount: 0.5 }, { id: 'vinheta' });
```

Set `exit: false` on clips that have their own exit, or the scene's default fade-out stacks on top.

### Lint warnings

`caju check` (and `caju check --json`) reports what is valid but won't look as intended:

| Code | Meaning |
|---|---|
| `CAJU_UNKNOWN_TRANSITION`, `CAJU_UNKNOWN_ANIMATION`, `CAJU_UNKNOWN_LOOP`, `CAJU_UNKNOWN_EFFECT` | a name that isn't in the catalog (the clip renders without it) |
| `CAJU_UNKNOWN_OVERLAY` (error) | an effect clip without a valid `props.effect` |
| `CAJU_MOTION_OVERLAP` | entrance + exit longer than the clip |
| `CAJU_ADJUSTMENT_EMPTY` | an adjustment clip with no enabled effect |
| `CAJU_OFFSCREEN` | the clip's anchor is outside the frame for its whole duration |
| `CAJU_UNSAFE_AREA` | text anchored inside the platform's unsafe inset ([safe areas](../reference/formats)) |
| `CAJU_TEXT_TOO_SMALL` | text below ~2.2 % of the frame height |
| `CAJU_LOW_CONTRAST` | text vs its background below WCAG 3:1 (large text) / 4.5:1 |
| `CAJU_EMPTY_FRAME` | more than 0.5 s with no visible clip |

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
