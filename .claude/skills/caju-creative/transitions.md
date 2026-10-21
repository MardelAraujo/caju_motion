# Transitions: when and which

## Cut first
- **Inside a scene** (same place, same idea): hard cuts or no cut at all. A punch-in (scale 1 → 1.15 over 1 frame, `hold`) beats a dissolve.
- **Between scenes**: a transition only when it says something (time passes, we go deeper, we switch topic). Use **1–2 kinds per film**, and keep at least a third of the seams as plain cuts.
- On music, cut on the beat (`caju beats`); with narration, cut in the breath between sentences, not mid-word.

## Which pose for what (`transitionIn/Out`, caju-authoring → motion.md)
| Intent | Pose | Frames | Notes |
|---|---|---|---|
| Next step, progress, "and then" | `slide` (`distance: 0` = full frame) | 10–16 | the default scene change; follow the vector law |
| Gentle topic change, calm films | `fade` | 8–15 | never between two busy scenes (mud in the middle) |
| Reveal a product shot or a word | `wipe` | 12–20 | direction = the film's direction |
| Focus in, "look here" | `iris` or `zoom` (`from: 0.85`) | 10–16 | iris reads playful; use once |
| Energy hit on a beat | `pop` + `flash` overlay (4–6 frames) | 6–10 | on the downbeat only |
| Dream, memory, soft focus | `blur` (`amount` 16–32) | 10–18 | pairs with a `grayscale`/`sepia` adjustment for flashbacks |
| Element enters a held frame | `rise` / `drop` (`distance` 30–80) | 14–20 | entrances of titles and cards, not whole scenes |
| Spin | `spin` | 12–18 | rarely; logos and stickers only |

Exits mirror their entrance (same side, accelerating). Exits are shorter than entrances: 6–12 frames.

## The vector law
**The exit direction of scene A is the entry direction of scene B**, at matched speed, so the eye keeps traveling one way.
- A leaves toward the left (`transitionOut: slide, direction: "left"`) → B arrives from the right (`transitionIn: slide, direction: "right"`): both travel right-to-left.
- Same duration and easing family on both sides (e.g. both 12 frames, `expoOut`).
- For both to move **at the same time** (a push), B must overlap A on an overlay track above it: B starts `transitionIn.duration` frames before A ends. Back to back on the same track, the background shows between them.
- Up/down pairs work the same: A out `up` → B in from `down`.

```json caju-project
{
  "schemaVersion": 1,
  "id": "vector-law",
  "name": "Vector law",
  "settings": { "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30, "background": "#171512", "duration": 120 },
  "tracks": [
    { "id": "cena-a", "kind": "main", "name": "Cena A", "clips": [
      { "id": "a-card", "type": "shape", "start": 0, "duration": 60, "transform": { "x": 540, "y": 960 },
        "props": { "shape": "rect", "width": 1080, "height": 1920, "fill": "#F6B73C" },
        "transitionOut": { "type": "slide", "duration": 12, "easing": "expoOut", "params": { "direction": "left" } } }
    ] },
    { "id": "cena-b", "kind": "overlay", "name": "Cena B", "clips": [
      { "id": "b-card", "type": "shape", "start": 48, "duration": 72, "transform": { "x": 540, "y": 960 },
        "props": { "shape": "rect", "width": 1080, "height": 1920, "fill": "#F47B35" },
        "transitionIn": { "type": "slide", "duration": 12, "easing": "expoOut", "params": { "direction": "right" } } }
    ] }
  ]
}
```

In `video.ts`, the same with named tracks (scene B starts 12 frames before A ends):
```ts caju-check
import { defineProject } from '@caju-motion/sdk';

export default defineProject({ id: 'vector-law', format: 'reel-9x16', background: '#171512', duration: 120 }, (p) => {
  p.tracks(['Cena A', 'Cena B']);
  p.scene('a', 'Cena A', 0, 60, (s) => {
    s.rect(1080, 1920, { fill: '#F6B73C' }, { id: 'a-card', x: 540, y: 960, track: 'Cena A', exit: false,
      transitionOut: { type: 'slide', dur: 12, easing: 'expoOut', params: { direction: 'left' } } });
  });
  p.scene('b', 'Cena B', 48, 120, (s) => {
    s.rect(1080, 1920, { fill: '#F47B35' }, { id: 'b-card', x: 540, y: 960, track: 'Cena B', exit: false,
      transitionIn: { type: 'slide', dur: 12, easing: 'expoOut', params: { direction: 'right' } } });
  });
});
```

## Other seams that work in Caju
| Seam | How |
|---|---|
| Color flood | a full-frame `shape` in the accent color wipes in (`wipe`, 10 f), the next scene is under it and the shape exits with `wipe` the same way |
| Dip to color | `colorOverlay` effect clip (`opacity` keyframed 0 → 1 → 0 over 10–14 f) straddling the cut |
| Flash cut | `flash` effect clip, 4–6 frames, starting on the cut frame |
| Carry across | one element (logo, product shot) on a named track spanning both scenes, moving with keyframes while the grounds change behind it |
| Match cut | the last frame of A and first of B share a shape/position (same circle size and place) |

## Don'ts
- A different transition at every seam.
- `fade` through black between every scene (the film keeps "ending").
- Transitions longer than 20 frames on social formats.
- Moving against the film's direction without a story reason.
