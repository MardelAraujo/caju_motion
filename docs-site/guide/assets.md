---
title: Assets
description: Prepare and register images, SVG, video, fonts and data in a Caju Motion project - folder layout, formats, sizes, metadata and ffmpeg recipes.
---

# Assets

Each asset is a **file inside the project folder** plus an **entry in `project.json` → `assets[]`**. Clips refer to assets by `assetId`.

## Registering an asset

```json
{ "id": "logo-acme", "kind": "image", "name": "Logo ACME", "src": "assets/images/logo-acme.svg",
  "meta": { "width": 800, "height": 240 } }
```

In `video.ts`: `p.asset({ id: 'logo-acme', kind: 'image', src: 'assets/images/logo-acme.svg', meta: { width: 800, height: 240 } })`.

| Field | Rule |
|---|---|
| `id` | unique across the **whole document** (assets, tracks, clips and markers share one namespace) |
| `kind` | `image`, `video` or `audio` (`font` and `lottie` are reserved, not rendered yet) |
| `src` | relative to the project folder, forward slashes, **no URLs** |
| `meta` | **always fill it**: `width`/`height` for images; `durationSec` for audio and video; video also `fps` and `hasAudio` |

The renderer sizes images from `props.width/height`, then `meta.width/height`, and falls back to **1920×1080**, a common bug. `caju check` fails when `src` does not exist on disk.

## Folder layout

```text
projects/<id>/assets/
  images/   video/   audio/{vo,music,sfx,amb}/   fonts/   data/
```

Names are lowercase kebab-case ASCII (`logo-acme.svg`, `vo-03-pricing.wav`). The asset id is the file name without extension, prefixed by kind when ambiguous (`img-hero`, `vo-03`).

## Measure, don't guess

```bash
ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of json assets/video/broll-01.mp4
```

Or let Caju do it: `npx caju media <id>` fills `meta` for every asset (videos, audio, images and SVGs) and builds thumbnails, waveforms and editing proxies ([`@caju-motion/media`](../reference/media)). In `video.ts`, use `measureMedia(file)`; it needs no ffprobe.

## Images

| Content | Format |
|---|---|
| Logos, icons, flat illustrations, diagrams | **SVG** (with `viewBox` and explicit `width`/`height`). PNG if the SVG uses filters or fonts |
| Photos, screenshots | **JPG** (quality 85–90) or **WebP** |
| Transparency, not vector | **PNG** (or WebP with alpha) |

- Export at roughly the on-screen size at scale 1, at most the project resolution. Planning a zoom to 1.3×? Export 1.3× bigger, not 4×. Keep files under ~2 MB.
- Text inside an SVG uses the browser's fonts: convert text to paths, or rasterize, for exact looks.
- Full-frame background: `width`/`height` = project size, `x`/`y` = project center, `"locked": true` so Studio clicks pass through.

```json
{ "id": "logo", "type": "image", "assetId": "logo-acme", "start": 0, "duration": 90,
  "transform": { "x": 540, "y": 400, "scale": 1 },
  "props": { "width": 600, "height": 180 } }
```

## Video

Phones and screen recorders often produce **variable frame rate** files, which makes seeking inaccurate. Normalize to H.264, constant frame rate (the project fps), with a short keyframe interval:

```bash
ffmpeg -i input.mov -vf "fps=30,scale=1920:-2" -c:v libx264 -preset medium -crf 18 \
  -g 30 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart assets/video/broll-01.mp4
```

```json
{ "id": "broll-01", "kind": "video", "src": "assets/video/broll-01.mp4",
  "meta": { "durationSec": 15.0, "width": 1920, "height": 1080, "fps": 30, "hasAudio": true } }
```

| Clip field | Meaning |
|---|---|
| `trimIn` | source frames skipped at the start |
| `duration` | timeline frames shown. Keep `trimIn + duration * speed <= durationSec * fps` |
| `speed` | playback rate (a 2× clip of 60 source frames lasts 30) |
| `audio` | `{ volume, fadeIn, fadeOut }` for the clip's own sound; `volume: 0` mutes b-roll under a voice-over |
| `props.width/height` | display size |

Video clips go on `main` or `overlay` tracks, never on audio tracks.

## Fonts

| `props.fontFamily` | Weights |
|---|---|
| `"Plus Jakarta Sans"` | 400, 500, 600, 700, 800 (default; the Caju brand font) |
| `"Red Hat Display"` | 400, 700, 800 |

Any other family falls back to the browser's `sans-serif` and will differ between machines. Font assets are planned. Until then, for a mandatory brand font, render the text as an SVG with outlined text (or a PNG) and place it as an image. In a repo checkout, local fonts that can't be redistributed can go in `packages/studio/public/fonts/local/` (git-ignored).

## Availability (v0.2)

| Asset | Preview (Studio) | Export |
|---|---|---|
| image (png/jpg/webp/svg) | ✓ | ✓ |
| video (mp4 H.264) | ✓ | ✓ exact seek per frame (convert VFR sources first) |
| audio | ✓ | ✓ mixed by FFmpeg ([Audio](./audio)) |
| font / lottie | reserved | planned |
| remote URLs | never | never |
