---
title: Rendering
description: Render Caju Motion projects locally to MP4, MOV ProRes, WebM, GIF or PNG frames with caju render and caju still - export settings, performance, the HTTP API and how to verify the output.
---

# Rendering

## How it works

- The renderer opens the project in headless Chromium and draws **one exact frame at a time**.
- It waits until fonts, images and video frames are ready (the `delayRender` gate), screenshots the frame and pipes it into FFmpeg, in order.
- Audio is mixed separately from the document (volume, fades, trim, speed) and muxed from t = 0. Measured A/V offset: 0 ms.

Requirements:

- A Chromium browser: installed Chrome or Edge, or `CAJU_BROWSER_PATH`. No browser download needed.
- FFmpeg: bundled (`ffmpeg-static`), or `CAJU_FFMPEG_PATH`.
- In a repo checkout only: build the Studio once with `npm run build -w @caju-motion/studio` (and again after Studio changes). Installed packages ship it prebuilt.

## Commands

```bash
caju render <id> [--out out.mp4] [--format mp4-h264] [--resolution 1080] [--fps 30] \
                 [--quality high] [--no-audio] [--concurrency 2] [--dir projects]
caju still  <id> --frame <n> [--out frame.png] [--resolution 1080] [--dir projects]
```

- Default output: `<project>/renders/<id>-<timestamp>.<ext>`.
- Ctrl+C cancels and deletes the partial file.
- `--serve-url http://localhost:3700` reuses a running Studio instead of starting an internal server.
- In the **Studio**, the **Exportar** button saves pending edits, then renders with progress, cancel and download.

## Export settings

### Format

| `--format` | Codec | Use for |
|---|---|---|
| `mp4-h264` (default) | H.264 + AAC | everything: social, web, messaging, slides |
| `mp4-h265` | HEVC | smaller files for modern devices |
| `mov-prores` | ProRes 422 | hand-off to editors (Premiere, Resolve, Final Cut) |
| `webm-vp9` | VP9 + Opus | web embeds |
| `gif` | GIF, no audio | short loops < 10 s, ≤ 720p |
| `png-seq` | PNG frames, no audio | compositing, frame-exact review |

### Resolution

`--resolution` is the **shorter side**: `720`, `1080` (native for every preset format), `1440` (2K), `2160` (4K). Output keeps the aspect ratio, rounded to even numbers. Upscaling doesn't add detail.

### FPS

`24`, `25`, `30`, `50`, `60` in the Studio; any integer 1–120 from the CLI. Match `settings.fps`: changing fps at export drops or duplicates frames.

### Quality

| `--quality` | Studio label | H.264 CRF | Use |
|---|---|---|---|
| `draft` | Rascunho | 28 | quick review |
| `good` | Boa | 23 | web |
| `high` (default) | Alta | 18 | social / final delivery |
| `max` | Máxima | 14 | archival, re-editing |

H.265 uses CRF + 5 for the same look; VP9 uses 40 / 34 / 28 / 22. ProRes, GIF and PNG don't use CRF.

### Platform cheat sheet

| Platform | Project format | Settings |
|---|---|---|
| Reels / TikTok / Shorts | `reel-9x16` | mp4-h264, 1080, 30 fps, high |
| Instagram feed | `feed-4x5` | mp4-h264, 1080, 30 fps, high |
| YouTube / LinkedIn / slides | `landscape-16x9` | mp4-h264, 1080 (or 2160), 30 fps, high |

## Performance

- Roughly 5–10 frames/s at 1080p with 2 pages, plus 8–15 s to start the browser. A 60 s reel takes about 3–6 min.
- Concurrency is capped at 2 pages. On machines short on memory, use `--concurrency 1`.
- Video clips are seeked with the browser's decoder: accurate for H.264 CFR files. Convert variable-frame-rate sources first ([Assets](./assets#video)).
- One render runs at a time per Studio; other jobs queue.

## HTTP API

While the Studio runs:

| Request | Returns |
|---|---|
| `POST /api/projects/:id/render` with export settings (JSON) | a job |
| `GET /api/render/jobs/:job` | job status |
| `GET /api/render/jobs/:job/file` | the rendered file |
| `GET /api/projects/:id/still?frame=N` | a PNG still |

The body accepts `{ format, resolution, fps, quality, audio }`; missing fields use the project defaults.

## Verify the output

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate -of json out/promo.mp4
```

1. **Duration** ≈ project duration / fps, within 1 frame (`settings.duration`, or the end of the last clip).
2. **Resolution** and **frame rate** equal what you chose.
3. **Audio stream** present when the project has audio and audio was enabled; 48000 Hz.
4. **Loudness** of the mix about −14 to −16 LUFS for social:
   ```bash
   ffmpeg -i out/promo.mp4 -af ebur128=framelog=quiet -f null - 2>&1 | grep -A2 "Integrated"
   ```
5. **A/V sync:** extract the frame at a known sound event. The repo fixture `fixtures/projects/landscape-audio` (white flash + beep at frame 30) is the reference.
6. **Visual spot-check** at scene changes:
   ```bash
   ffmpeg -ss 00:00:03.000 -i out/promo.mp4 -frames:v 1 out/check-3s.png
   ```

## Availability (v0.2)

| Capability | Status |
|---|---|
| MP4 H.264/H.265, MOV ProRes, WebM VP9, GIF, PNG sequence | ✓ |
| Stills (PNG) | ✓ |
| Custom component clips | ✓ (loaded from `components/`) |
| Cloud / distributed render | planned (F4) |
