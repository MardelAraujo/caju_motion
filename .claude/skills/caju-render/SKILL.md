---
name: caju-render
description: Export Caju Motion projects to video or stills (caju render / caju still / the Studio Export button), choose codec, resolution, fps and quality, and verify the output (duration, resolution, audio, A/V sync). Use when the user asks to render, export, download, publish or preview a frame of a Caju video.
version: 0.2.0
---

# Rendering Caju videos

## How it works
- The renderer opens the project in headless Chromium, one exact frame at a time (`window.__caju.setFrame(n)`).
- It waits until fonts, images and video frames are ready, screenshots each frame and pipes the frames into FFmpeg in order.
- Audio is mixed separately from the document (volume, fades, trim, speed, pan) and muxed with the start at t = 0. Measured A/V offset: 0 ms.

Requirements:
- A Chromium browser: installed Chrome or Edge, or `CAJU_BROWSER_PATH`.
- FFmpeg: the bundled `ffmpeg-static`, or `CAJU_FFMPEG_PATH`.
- The built Studio. Inside the repo checkout, run `npm run build -w @caju-motion/studio` once (and again after Studio changes).

## Commands (repo checkout: `npm run caju -- …`; after release: `npx caju …`)
```bash
caju render <id> [--out out.mp4] [--format mp4-h264] [--resolution 1080] [--fps 30] [--quality high] [--no-audio] [--concurrency 2] [--dir projects]
caju still  <id> --frame <n> [--out frame.png] [--resolution 1080] [--dir projects]
```
- The default output is `<project>/renders/<id>-<timestamp>.<ext>`.
- Ctrl+C cancels a render and deletes the partial file.
- `--serve-url http://localhost:3700` reuses a Studio that is already running instead of starting an internal server.
- In the **Studio**, the Exportar button saves pending edits, then renders with progress, cancel and download.
- Over HTTP, while the Studio runs:
  - `POST /api/projects/:id/render` with ExportSettings returns a job;
  - `GET /api/render/jobs/:job` returns its status;
  - `GET /api/render/jobs/:job/file` downloads the result;
  - `GET /api/projects/:id/still?frame=N` returns a still.

Settings: [export-settings.md](export-settings.md). Verification: [verify-output.md](verify-output.md). **Always verify before telling the user the file is done.**

## Performance and limits
- Expect roughly 5–10 frames per second at 1080p with 2 pages, plus 8–15 s to start the browser. A 60 s reel takes about 3–6 min. Tell the user up front for long videos.
- Concurrency is capped at 2 pages. More pages need more RAM, and on machines short on memory use `--concurrency 1`.
- Video clips are seeked with the browser's decoder. They are accurate for normal H.264 CFR files; for VFR sources, convert first (caju-assets → video.md). Frame-exact WebCodecs decode is planned.
- One render runs at a time per Studio. Other jobs wait in the queue.

## Availability (v0.2.0)
| Capability | Status |
|---|---|
| MP4 H.264/H.265, MOV ProRes, WebM VP9, GIF, PNG sequence | ✓ |
| Stills (PNG) | ✓ |
| Custom component clips in renders | ✓ (loaded from `components/`) |
| Cloud / distributed render | `@caju-motion/cloud` (F4, commercial) |
