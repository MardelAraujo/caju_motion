---
title: project.json schema
description: Reference for the Caju Motion project.json document (schemaVersion 1) - settings, assets, tracks, clips, transform, keyframes, audio, markers, meta, and the validation rules caju check enforces.
---

# `project.json` schema

The document is defined with zod in `@caju-motion/schema` (`ProjectSchema`). Current `schemaVersion`: **1**. Fields with defaults may be omitted.

## Complete minimal example

A 5-second reel: background, logo, animated title, voice-over and a music bed.

```json
{
  "schemaVersion": 1,
  "id": "promo-reel",
  "name": "Promo reel",
  "settings": { "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30, "background": "#0C0B0E", "duration": 150 },
  "assets": [
    { "id": "logo-acme", "kind": "image", "name": "Logo", "src": "assets/images/logo-acme.svg", "meta": { "width": 600, "height": 180 } },
    { "id": "vo-01", "kind": "audio", "name": "Voice 1", "src": "assets/audio/vo/vo-01.wav", "meta": { "durationSec": 3.4 } },
    { "id": "mus-bed", "kind": "audio", "name": "Music", "src": "assets/audio/music/mus-bed.mp3", "meta": { "durationSec": 30 } }
  ],
  "tracks": [
    {
      "id": "main", "kind": "main", "name": "Background",
      "clips": [
        { "id": "bg", "type": "shape", "name": "Background", "start": 0, "duration": 150, "locked": true,
          "transform": { "x": 540, "y": 960 },
          "props": { "shape": "rect", "width": 1080, "height": 1920, "fill": "#171512" } }
      ]
    },
    {
      "id": "camada-1", "kind": "overlay", "name": "Logo",
      "clips": [
        { "id": "logo", "type": "image", "assetId": "logo-acme", "start": 0, "duration": 150,
          "transform": { "x": 540, "y": 520 },
          "props": { "width": 600, "height": 180 },
          "keyframes": {
            "opacity": [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 15, "value": 1 }],
            "transform.scale": [{ "frame": 0, "value": 0.8, "easing": "backOut" }, { "frame": 15, "value": 1 }]
          } }
      ]
    },
    {
      "id": "texto-1", "kind": "text", "name": "Title",
      "clips": [
        { "id": "title", "type": "text", "name": "Title", "start": 12, "duration": 138,
          "transform": { "x": 540, "y": 960 },
          "props": { "text": "Code it.\nThen move it.", "fontFamily": "Plus Jakarta Sans", "fontSize": 110, "fontWeight": 800,
                     "color": "#FFF8E9", "align": "center", "lineHeight": 1.1, "letterSpacing": 0, "background": "" },
          "keyframes": {
            "opacity": [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 18, "value": 1 },
                        { "frame": 125, "value": 1, "easing": "easeIn" }, { "frame": 137, "value": 0 }],
            "transform.y": [{ "frame": 0, "value": 1000, "easing": "softOut" }, { "frame": 18, "value": 960 }]
          } }
      ]
    },
    {
      "id": "locucao", "kind": "audio", "name": "Voice-over",
      "clips": [
        { "id": "vo-01-clip", "type": "audio", "assetId": "vo-01", "start": 15, "duration": 102,
          "audio": { "volume": 1, "fadeIn": 0, "fadeOut": 3 } }
      ]
    },
    {
      "id": "audio-mus-0", "kind": "audio", "name": "Music",
      "clips": [
        { "id": "mus-bed-1", "type": "audio", "assetId": "mus-bed", "start": 0, "duration": 150,
          "audio": { "volume": 0.2, "fadeIn": 15, "fadeOut": 30 } }
      ]
    }
  ],
  "markers": [{ "id": "m-title", "frame": 12, "label": "Title in" }],
  "meta": { "generator": "my-agent" }
}
```

## Project

| Field | Type | Default | Notes |
|---|---|---|---|
| `schemaVersion` | `1` | — | required |
| `id` | string | — | equals the folder name |
| `name` | string | — | non-empty |
| `settings` | object | — | see below |
| `assets` | `Asset[]` | `[]` | |
| `tracks` | `Track[]` | `[]` | index 0 = bottom (drawn first) |
| `markers` | `Marker[]` | `[]` | |
| `meta` | `{ createdAt?, updatedAt?, generator? }` | `{}` | generators set only `generator` |

## `settings`

| Field | Type | Default | Notes |
|---|---|---|---|
| `format` | `reel-9x16` \| `feed-4x5` \| `square-1x1` \| `landscape-16x9` \| `custom` | `custom` | width/height must match the preset ([formats](./formats)) |
| `width`, `height` | int > 0 | — | project pixels |
| `fps` | int > 0 | — | 30 for every preset |
| `background` | hex | `#000000` | |
| `duration` | int > 0 | end of last clip | frames |
| `audio` | `{ ducking?, loudness? }`? | | export mix: music ducked under voice, final loudness ([Audio](../guide/audio#ducking)) |

## `Asset`

| Field | Type | Notes |
|---|---|---|
| `id` | string | global namespace |
| `kind` | `video` \| `image` \| `audio` \| `font` \| `lottie` | `font`/`lottie` reserved |
| `name` | string? | |
| `src` | string | relative path (`assets/...`), forward slashes |
| `hash` | string? | |
| `meta` | `{ durationSec?, width?, height?, fps?, hasAudio? }` | default `{}`; always fill it |

## `Track`

| Field | Type | Default |
|---|---|---|
| `id` | string | — |
| `kind` | `main` \| `overlay` \| `text` \| `audio` \| `effect` | — |
| `name` | string? | |
| `locked`, `hidden`, `muted` | boolean | `false` |
| `role` | `voice` \| `music` \| `sfx`? | | audio tracks: who ducks whom |
| `clips` | `Clip[]` | `[]` |

## `Clip`

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | — | global namespace |
| `type` | `video` \| `image` \| `audio` \| `text` \| `shape` \| `component` \| `effect` \| `adjustment` | — | `effect` = full-frame overlay (`props.effect`); `adjustment` filters the layers below |
| `name` | string? | | |
| `start` | int ≥ 0 | — | frame |
| `duration` | int ≥ 1 | — | frames |
| `assetId` | string? | | required for `video`/`image`/`audio` |
| `trimIn` | int ≥ 0 | `0` | source frames skipped |
| `speed` | > 0 | `1` | |
| `transform` | object | see below | |
| `opacity` | 0–1 | `1` | |
| `blendMode` | `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `soft-light`, `hard-light`, `difference` | `normal` | |
| `keyframes` | `{ [path]: Keyframe[] }` | `{}` | [Animation](../guide/animation) |
| `props` | object | `{}` | type-specific (below) |
| `audio` | `{ volume ≥ 0 = 1, fadeIn = 0, fadeOut = 0, pan -1..1 = 0 }`? | | `audio.volume` can be keyframed |
| `origin` | `editor` \| `code` | `editor` | |
| `locked`, `hidden` | boolean | `false` | |
| `effects` | `{ id, type, enabled = true, params }[]` | `[]` | CSS filters ([Animation → motion presets](../guide/animation#motion-presets)) |
| `transitionIn`, `transitionOut` | `{ type, duration, easing = easeInOut, params }`? | | entrance/exit pose |
| `animationIn`, `animationOut`, `animationLoop` | `{ preset, duration, params }`? | | entrance/exit pose; loop (`duration` = period) |

### `transform`

| Field | Default | Notes |
|---|---|---|
| `x`, `y` | `0` | anchor position in project px; origin top-left |
| `scale` | `1` | |
| `rotation` | `0` | degrees, clockwise |
| `anchorX`, `anchorY` | `0.5` | fraction of the element's box, 0–1 |
| `flipX`, `flipY` | `false` | |

### `Keyframe`

`{ frame: int ≥ 0 (relative to clip start), value: number | string, easing = 'linear' }`. Easing: `linear`, `hold`, `easeIn`, `easeOut`, `easeInOut`, `expoOut`, `expoInOut`, `softOut`, `backOut`, or `{ "bezier": [x1, y1, x2, y2] }`.

### `props` by clip type

| Type | Props |
|---|---|
| `text` | `text` (`\n` breaks lines; no auto-wrap), `fontFamily`, `fontSize`, `fontWeight`, `color`, `align`, `lineHeight`, `letterSpacing`, `background` (hex or `""`) |
| `shape` | `shape` (`rect` \| `ellipse`), `width`, `height`, `fill`, `stroke` (hex, `#RRGGBBAA`, or `""`), `strokeWidth` |
| `image`, `video` | `width`, `height` (display box; always set them) |
| `component` | `component` (registered name), `width`, `height`, plus the component's own props |

## `Marker`

`{ id, frame: int ≥ 0, label = '', color = '#F6B73C' }`.

## Validation rules

`caju check` fails on any of these:

1. `schemaVersion` must be `1`.
2. **Ids are unique across assets, tracks, clips and markers together.** A clip and its asset can't share an id.
3. **No overlapping clips on the same track** (`start < prev.start + prev.duration`).
4. Audio clips only on `audio` tracks, and nothing else there.
5. `video` / `image` / `audio` clips need an `assetId` that exists and whose `kind` equals the clip `type`.
6. A keyframe `frame` is relative to the clip start and must be `< duration`.
7. Every frame field is an integer ≥ 0; `duration` ≥ 1; `opacity` and anchors in 0–1; `audio.volume` ≥ 0.
8. Every asset `src` exists on disk, relative to the project folder.
9. Component clips reference a component that exists in `components/`, and the components pass the determinism lint.

## `meta` and human edits

- `meta.generator` identifies your script.
- **Never set `meta.createdAt` / `meta.updatedAt` from a generator.** `caju new` sets both to the same value; the Studio rewrites `updatedAt` on save. `updatedAt !== createdAt` means a human edited the project ([Caju Studio](../guide/studio)).
