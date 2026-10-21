# Motion: transitions, animations, loops, effects, overlays, adjustments

Keyframes ([animation.md](animation.md)) move any property by hand. The fields below are **named presets** the renderer draws for you: less JSON, the same in preview and export, and editable as one value instead of four keyframes. All of them are pure functions of the frame.

Before hand-authoring a named look, run `caju catalog --query "<look>"` (or `--kind transition|loop|effect|overlay`): it lists what exists, with labels and params.

## Entrances and exits (`transitionIn/Out`, `animationIn/Out`)
Both use the same library of **poses**. A pose goes from "off screen" to "at rest" over `duration` frames.
- **Entrance** plays over the first `duration` frames of the clip.
- **Exit** plays over the last `duration` frames, and is the entrance **mirrored**: it leaves by the same side (`direction`) with the mirrored easing. An `expoOut` entrance (decelerating) becomes an accelerating exit. Don't invert the direction for the exit yourself.
- Transitions and animations stack: a clip can have `transitionIn: fade` and `animationIn: rise` at once. Keyframes still apply on top.
- Entrance + exit longer than the clip → `CAJU_MOTION_OVERLAP`. Keep `in + out ≤ duration`.

| Pose | Look | Params (default) | Pose easing |
|---|---|---|---|
| `fade` | opacity 0 → 1 | — | `easeInOut` |
| `slide` | moves in from a side | `direction` left\|right\|up\|down (`left`), `distance` px (`0` = the whole frame) | `expoOut` |
| `rise` | moves up into place + fade | `distance` px (80) | `expoOut` |
| `drop` | moves down into place + fade | `distance` px (80) | `expoOut` |
| `zoom` | scale `from` → 1 + fade | `from` (0.6) | `expoOut` |
| `pop` | scale 0.4 → 1 with overshoot + fast fade | — | `backOut` |
| `blur` | blur `amount` px → 0 + fade | `amount` (24) | `easeOut` |
| `spin` | rotate `degrees` → 0, scale 0.6 → 1 + fade | `degrees` (-90) | `expoOut` |
| `wipe` | clip-path reveal from one side | `direction` (`left`) | `easeInOut` |
| `iris` | circle reveal from the center | — | `easeInOut` |

Aliases: `push` → slide, `dissolve`/`crossfade`/`fade-in` → fade, `fade-up` → rise, `fade-down` → drop, `scale`/`zoom-in`/`scale-in` → zoom, `reveal` → wipe. Unknown names give `CAJU_UNKNOWN_TRANSITION` / `CAJU_UNKNOWN_ANIMATION` and the clip just appears.

Shapes in the document:
```json
"transitionIn":  { "type": "slide", "duration": 15, "easing": "expoOut", "params": { "direction": "right" } },
"transitionOut": { "type": "fade",  "duration": 10 },
"animationIn":   { "preset": "rise", "duration": 18, "params": { "distance": 60, "easing": "softOut" } },
"animationOut":  { "preset": "blur", "duration": 8 }
```
- `transitionIn/Out`: `type`, `duration`, `easing`, `params`. Without `easing`, the pose's own easing applies (`expoOut` for slide/rise/zoom, `backOut` for pop); set it only to override.
- `animationIn/Out`: `preset`, `duration`, `params`; an optional easing goes in `params.easing`, otherwise the pose's default easing (table above) applies.

### Transitions don't overlap clips
Clips on one track can't overlap, so a transition never blends two clips by itself: **each clip animates itself**. A scene that fades out and the next that fades in pass through the background in between.
- **Cut with motion** (most common): scene A `transitionOut` 8–12 frames, scene B `transitionIn` 12–18 frames, back to back.
- **True crossfade / push:** put the incoming clip on an **overlay track above**, starting 8–15 frames before the outgoing clip ends, with `transitionIn` the same length as the overlap. The outgoing clip may keep its own `transitionOut` for a push.

## Loops (`animationLoop`)
Continuous motion while the clip plays. `duration` is the **period** in frames; `params.amplitude` scales the intensity (default 1).

| Loop | Look at amplitude 1 |
|---|---|
| `pulse` | scale ±6 % |
| `float` | y ±12 px |
| `wiggle` | rotation ±4° |
| `breathe` | opacity dips to 75 % |
| `spin` | full turn per period (amplitude 2 = two turns) |

```json
"animationLoop": { "preset": "float", "duration": 90, "params": { "amplitude": 0.8 } }
```
Use loops on secondary things (a badge, an arrow, a background shape). A looping title looks generated (caju-creative → motion-principles).

## Effects (`effects[]`, CSS filters on the clip)
```json
"effects": [
  { "id": "hero-fx1", "type": "dropShadow", "params": { "y": 16, "blur": 32, "color": "#00000066" } },
  { "id": "hero-fx2", "type": "saturate", "params": { "amount": 1.2 } }
]
```
| Effect | Params (default) |
|---|---|
| `blur` | `radius` px (8) |
| `brightness` / `contrast` / `saturate` | `amount` (1.2 / 1.2 / 1.4) |
| `grayscale` / `sepia` / `invert` | `amount` 0–1 (1 / 0.8 / 1) |
| `hueRotate` | `degrees` (90) |
| `dropShadow` | `x` (0), `y` (12), `blur` (24), `color` (`#00000080`) |

- `id` is unique in the whole document (the SDK names them `<clipId>-fx1`…). `enabled: false` turns one off.
- Animate a param with keyframes on **`effects.<id>.<param>`**, e.g. `"effects.hero-fx1.blur": [{ "frame": 0, "value": 0 }, { "frame": 20, "value": 32 }]`.
- Unknown type → `CAJU_UNKNOWN_EFFECT` (ignored in the render).

## Overlay clips (`type: "effect"`)
A full-frame layer chosen by `props.effect`. Put it on an overlay track above what it covers. Params live in `props` and can be keyframed as `props.<name>`.

| `props.effect` | Params (default) | Use |
|---|---|---|
| `vignette` | `amount` (0.6), `color` (`#000000`) | darken edges, focus the center |
| `letterbox` | `ratio` (2.39), `color` | cinema bars |
| `colorOverlay` | `color` (`#F47B35`), `opacity` (0.25) | tint, brand wash, dip to color |
| `flash` | `color` (`#FFFFFF`) | full flash at the clip start fading to 0 by its end (4–8 frames on a hit) |
| `grain` | `amount` (0.12) | film grain (deterministic per frame) |

A missing or unknown `props.effect` is an **error** (`CAJU_UNKNOWN_OVERLAY`).

## Adjustment clips (`type: "adjustment"`)
Applies its `effects[]` to **everything below its track** (including the project background) while it is active. Use it for a global grade, a black-and-white flashback, or a blur behind a modal card.
- No effects → `CAJU_ADJUSTMENT_EMPTY`.
- Layers above the adjustment track are not affected: put titles above it.

## Complete example (project.json)
```json caju-project
{
  "schemaVersion": 1,
  "id": "motion-demo",
  "name": "Motion demo",
  "settings": { "format": "landscape-16x9", "width": 1920, "height": 1080, "fps": 30, "background": "#171512", "duration": 180 },
  "tracks": [
    { "id": "main", "kind": "main", "name": "Cenas", "clips": [
      { "id": "card-a", "type": "shape", "start": 0, "duration": 90,
        "transform": { "x": 960, "y": 540 },
        "props": { "shape": "rect", "width": 1200, "height": 600, "fill": "#F6B73C" },
        "transitionIn": { "type": "fade", "duration": 12 },
        "transitionOut": { "type": "slide", "duration": 12, "easing": "expoOut", "params": { "direction": "left" } } }
    ] },
    { "id": "entrada", "kind": "overlay", "name": "Entrada", "clips": [
      { "id": "card-b", "type": "shape", "start": 78, "duration": 102,
        "transform": { "x": 960, "y": 540 },
        "props": { "shape": "rect", "width": 1200, "height": 600, "fill": "#F47B35" },
        "transitionIn": { "type": "slide", "duration": 12, "easing": "expoOut", "params": { "direction": "right" } },
        "animationLoop": { "preset": "float", "duration": 90, "params": { "amplitude": 0.5 } },
        "effects": [{ "id": "card-b-fx1", "type": "dropShadow", "params": { "y": 20, "blur": 40 } }] }
    ] },
    { "id": "grade", "kind": "overlay", "name": "Ajuste", "clips": [
      { "id": "grade-1", "type": "adjustment", "start": 0, "duration": 180,
        "effects": [{ "id": "grade-1-fx1", "type": "contrast", "params": { "amount": 1.1 } }] }
    ] },
    { "id": "titulos", "kind": "text", "name": "Títulos", "clips": [
      { "id": "title-a", "type": "text", "start": 6, "duration": 78,
        "transform": { "x": 960, "y": 540 },
        "props": { "text": "Before", "fontFamily": "Plus Jakarta Sans", "fontSize": 120, "fontWeight": 800, "color": "#171512" },
        "animationIn": { "preset": "rise", "duration": 18, "params": { "distance": 40 } },
        "animationOut": { "preset": "slide", "duration": 10, "params": { "direction": "left", "distance": 200 } } }
    ] },
    { "id": "fx", "kind": "overlay", "name": "Sobreposições", "clips": [
      { "id": "vinheta", "type": "effect", "start": 0, "duration": 180, "props": { "effect": "vignette", "amount": 0.5 } }
    ] }
  ]
}
```
Card A leaves to the left while card B, on the track above, enters from the right during frames 78–90: one direction of travel across the cut (the "vector law" in caju-creative → transitions).

## In `video.ts`
```ts caju-check
import { defineProject } from '@caju-motion/sdk';

export default defineProject({ id: 'motion-demo', format: 'landscape-16x9', background: '#171512', duration: 180 }, (p) => {
  p.tracks(['Cenas', 'Entrada']);
  p.scene('a', 'Antes', 0, 90, (s) => {
    s.rect(1200, 600, { fill: '#F6B73C' }, {
      id: 'card-a', x: 960, y: 540, track: 'Cenas', exit: false,
      transitionIn: { type: 'fade', dur: 12 },
      transitionOut: { type: 'slide', dur: 12, easing: 'expoOut', params: { direction: 'left' } },
    });
    s.text('Before', { size: 120, weight: 800, color: '#171512' }, {
      id: 'title-a', x: 960, y: 540, at: [6, 84], exit: false,
      animIn: { type: 'rise', dur: 18, params: { distance: 40 } },
      animOut: { type: 'slide', dur: 10, params: { direction: 'left', distance: 200 } },
    });
  });
  p.scene('b', 'Depois', 78, 180, (s) => {
    s.rect(1200, 600, { fill: '#F47B35' }, {
      id: 'card-b', x: 960, y: 540, track: 'Entrada', exit: false,
      transitionIn: { type: 'slide', dur: 12, easing: 'expoOut', params: { direction: 'right' } },
      loop: { type: 'float', dur: 90, amplitude: 0.5 },
      effects: [{ type: 'dropShadow', params: { y: 20, blur: 40 } }],
    });
    s.adjust([{ type: 'contrast', params: { amount: 1.1 } }], { id: 'grade-b', exit: false });
    s.overlay('vignette', { amount: 0.5 }, { id: 'vinheta-b', exit: false });
  });
});
```
- `ElOpts`: `transitionIn`/`transitionOut`/`animIn`/`animOut` = `{ type, dur, easing?, params? }`; `loop` = `{ type, dur, amplitude? }`; `effects` = `[{ type, params?, id? }]`.
- `s.overlay(effect, params, el)` adds a `type: "effect"` clip; `s.adjust(effects, el)` adds an adjustment clip. Both go on `effect` tracks **above** every visual and text layer (so an adjustment also filters text), and neither gets the scene's exit fade unless you pass `exit`.
- Pass `exit: false` when a clip has its own `transitionOut`/`animOut`; otherwise the scene's default fade-out keyframes stack on top.

## Lint codes (`caju check`)
| Code | Meaning | Fix |
|---|---|---|
| `CAJU_UNKNOWN_TRANSITION` / `CAJU_UNKNOWN_ANIMATION` / `CAJU_UNKNOWN_LOOP` / `CAJU_UNKNOWN_EFFECT` | name not in the catalog | use a name from the tables above or `caju catalog` |
| `CAJU_UNKNOWN_OVERLAY` (error) | effect clip without a valid `props.effect` | set `vignette`, `letterbox`, `colorOverlay`, `flash` or `grain` |
| `CAJU_MOTION_OVERLAP` | entrance + exit longer than the clip | shorten them or lengthen the clip |
| `CAJU_ADJUSTMENT_EMPTY` | adjustment clip with no enabled effect | add an effect or delete the clip |
| `CAJU_OFFSCREEN` | the clip's anchor is outside the frame for its whole duration | fix `x`/`y` (often a pixel/fraction mix-up) |
| `CAJU_UNSAFE_AREA` | text/caption anchor inside the platform's unsafe inset | move it inside the safe area ([elements.md](elements.md)) |
| `CAJU_TEXT_TOO_SMALL` | font size below ~2.2 % of the frame height | raise it (caju-creative → typography) |
| `CAJU_LOW_CONTRAST` | text vs its own background (or the project background) below WCAG 3:1 large / 4.5:1 | change color or add `background` |
| `CAJU_EMPTY_FRAME` | more than 0.5 s with no visible clip | extend a clip, add a background or shorten the gap |

`caju check --json` prints the same issues as data. Treat every code as a question: fix it, or keep it on purpose and tell the user why.
