# project.json reference

## Complete minimal example (valid, schemaVersion 1)
A 5-second reel: background, logo, animated title, voice-over and music bed.

```json caju-project
{
  "schemaVersion": 1,
  "id": "promo-reel",
  "name": "Promo reel",
  "settings": { "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30, "background": "#0C0B0E", "duration": 150 },
  "assets": [
    { "id": "logo-acme", "kind": "image", "name": "Logo", "src": "assets/images/logo-acme.svg", "meta": { "width": 600, "height": 180 } },
    { "id": "vo-01", "kind": "audio", "name": "Locução 1", "src": "assets/audio/vo/vo-01.wav", "meta": { "durationSec": 3.4 } },
    { "id": "mus-bed", "kind": "audio", "name": "Trilha", "src": "assets/audio/music/mus-bed.mp3", "meta": { "durationSec": 30 } }
  ],
  "tracks": [
    {
      "id": "main", "kind": "main", "name": "Fundo",
      "clips": [
        { "id": "bg", "type": "shape", "name": "Fundo", "start": 0, "duration": 150, "locked": true,
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
      "id": "texto-1", "kind": "text", "name": "Título",
      "clips": [
        { "id": "title", "type": "text", "name": "Título", "start": 12, "duration": 138,
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
      "id": "locucao", "kind": "audio", "name": "Locução",
      "clips": [
        { "id": "vo-01-clip", "type": "audio", "assetId": "vo-01", "start": 15, "duration": 102,
          "audio": { "volume": 1, "fadeIn": 0, "fadeOut": 3 } }
      ]
    },
    {
      "id": "audio-mus-0", "kind": "audio", "name": "Trilha sonora",
      "clips": [
        { "id": "mus-bed-1", "type": "audio", "assetId": "mus-bed", "start": 0, "duration": 150,
          "audio": { "volume": 0.2, "fadeIn": 15, "fadeOut": 30 } }
      ]
    }
  ],
  "markers": [{ "id": "m-title", "frame": 12, "label": "Título entra" }],
  "meta": { "generator": "my-agent" }
}
```

## Validation rules (`check` fails on these)
1. `schemaVersion` must be `1`.
2. **Ids are unique across assets, tracks, clips and markers together.** A clip and its asset can't share an id: asset `vo-01`, clip `vo-01-clip`.
3. **No overlapping clips on the same track** (`start < prev.start + prev.duration` is an error). Use more tracks.
4. Audio clips only on `kind: "audio"` tracks, and nothing else there.
5. `video` / `image` / `audio` clips need an `assetId` that exists and whose `kind` equals the clip `type`.
6. Keyframe `frame` is **relative to the clip start** and must be `< duration`.
7. Integers ≥ 0 for every frame field. `duration` ≥ 1. `opacity` in 0–1. `anchorX/Y` in 0–1. `audio.volume` ≥ 0.
8. Every asset `src` must exist on disk (relative to the project folder).

## Settings
- `format`: `reel-9x16` (1080×1920), `feed-4x5` (1080×1350), `square-1x1` (1080×1080), `landscape-16x9` (1920×1080), or `custom`. Width and height must match the format.
- `fps`: integer (30 by default).
- `background`: hex color.
- `duration`: frames. Omit it to end at the last clip.

## `meta`
- `meta.generator`: identifies your script.
- **Never set `meta.createdAt` / `meta.updatedAt`** from a generator.
  - `caju new` sets both to the same value.
  - The Studio rewrites `updatedAt` on save.
  - `updatedAt !== createdAt` is how human edits are detected (see caju-studio).
