---
name: caju-assets
description: How to structure, prepare and register assets (images, SVG, video, fonts, data) in a Caju Motion project. Use whenever a Caju video needs files: logos, photos, screenshots, illustrations, b-roll, backgrounds, icons, brand kits, JSON data, or when check reports missing assets.
version: 0.1.0
---

# Caju assets

Each asset is a **file inside the project folder** plus an **entry in `project.json` → `assets[]`**. Clips refer to assets by `assetId`.

## Folder structure (convention)
```
projects/<id>/
  project.json
  assets/
    images/      png, jpg, webp, svg (logos, photos, illustrations, backgrounds)
    video/       mp4 (H.264, constant frame rate)
    audio/
      vo/        voice-over (one file per sentence/scene)
      music/     soundtrack
      sfx/       sound effects
      amb/       ambience / room tone
    fonts/       woff2 (reserved; see Availability)
    data/        json/csv used by generator scripts (not read by the renderer)
```
- Files the Studio uploads land in `assets/` root with a sanitized name. That is valid; move them only if the user asks.
- **Names:** lowercase kebab-case, ASCII, no spaces, stable over time (`logo-acme.svg`, `vo-03-pricing.mp3`). The Linux render is case-sensitive.
- **Asset id** = file name without extension, prefixed by kind when ambiguous (`img-hero`, `vo-03`).
  - Ids are unique across the **whole document**: assets, tracks, clips and markers share one namespace.

## Registering an asset
```json
{ "id": "logo-acme", "kind": "image", "name": "Logo ACME", "src": "assets/images/logo-acme.svg",
  "meta": { "width": 800, "height": 240 } }
```
- `kind`: `image`, `video` or `audio`. `font` and `lottie` are reserved and not rendered yet.
- `src`: relative to the project folder, forward slashes, no URLs.
- `meta`:
  - **always fill it.** The renderer sizes images from `props.width/height`, then `meta.width/height`, and falls back to **1920×1080**, which is a common bug.
  - Audio and video need `durationSec`.
  - Video also needs `width`, `height`, `fps` and `hasAudio`.
- `check` fails when `src` does not exist on disk.

Per-type rules:
- [images.md](images.md): formats, sizes, SVG, transparency, rasterizing.
- [video.md](video.md): converting to H.264 CFR, trimming, keyframe interval, metadata.
- [fonts-and-text.md](fonts-and-text.md): available fonts, brand fonts, licensing.
- Audio files: see [caju-audio](../caju-audio/SKILL.md).

## Measure, don't guess
```bash
ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of json assets/video/broll-01.mp4
```
For images, read the size with a library such as `sharp` (`(await sharp(file).metadata()).width`), or from the SVG `viewBox`.

## Availability (v0.1.0)
| Asset | Preview (Studio) | Export |
|---|---|---|
| image (png/jpg/webp/svg) | ✓ | F1 (render) |
| video (mp4 H.264) | ✓ native `<video>`, may be off by ±1 frame when seeking | F1, frame-exact |
| audio | ✓ | F1 (mixed by ffmpeg) |
| font / lottie | ✗ (reserved kinds) | F2 |
| remote URLs | ✗ never | ✗ never |
