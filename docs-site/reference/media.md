---
title: '@caju-motion/media'
description: Media tools for Caju Motion - caju media fills asset metadata and builds thumbnails, waveforms and editing proxies; probeMedia, thumbnail, waveform, createProxy; frame-exact video decoding in the browser with WebCodecs.
---

# `@caju-motion/media`

Media tools built on the FFmpeg that ships with Caju (`ffmpeg-static`, no ffprobe needed).

## `caju media`

```bash
npx caju media                        # every project
npx caju media meu-video --proxies auto
```

For each asset of the project it:

1. reads duration, size, fps and audio, and writes them to `asset.meta` in `project.json`, plus a content `hash` (saved with history, like the Studio does; it refuses if the Studio saved in the meantime);
2. builds, in `projects/<id>/.caju/media/` (git-ignored):
   - a **thumbnail** for videos and images;
   - **waveform** peaks for audio and for videos with sound, which the Studio timeline uses directly;
   - an **editing proxy** for videos, with `--proxies auto` (only heavy videos: taller than ~720 px or not H.264) or `--proxies all`.

The cache is keyed by file content, so renaming a file reuses it and replacing a file rebuilds it. Running the command again only does what is missing (`--force` redoes everything; `--dry-run` writes nothing).

**Proxies** are light H.264 copies (540p, a keyframe every 15 frames) that the Studio plays while you edit, so 4K or HEVC footage scrubs smoothly. Export (`caju render` and the Export button) always uses the original files.

## Node API

```ts
import { probeMedia, thumbnail, waveform, createProxy, analyzeProject } from '@caju-motion/media';
```

| Export | |
|---|---|
| `probeMedia(file)` | `{ kind, durationSec, width, height, fps, hasAudio, hasVideo, videoCodec, audioCodec, sampleRate, rotation }`. Width and height are the display size (phone rotation applied). SVGs are read from their `width`/`height` or `viewBox` |
| `thumbnail(file, { out, atSec?, width? })` | JPG/PNG/WebP of a video or image frame |
| `waveform(file, { perSecond? })` | `{ perSecond, durationSec, peaks }`, mono peaks from 0 to 1 |
| `createProxy(file, { out, height?, keyint? })` | editing proxy (MP4) |
| `hashFile(file)` | SHA-256 of the content |
| `analyzeProject(projectDir, project, { thumbnails?, peaks?, proxies?, force? })` | what `caju media` does; returns the updated project and a report per asset (does not write `project.json`) |
| `findDerived(projectDir, src, 'thumb' \| 'peaks' \| 'proxy')` | path of a derived file, or `null` if it is missing or stale |
| `ffmpegPath()`, `execFfmpeg(args)` | the FFmpeg in use (`CAJU_FFMPEG_PATH` > `ffmpeg-static` > `PATH`) |

`measureMedia(file)` in `@caju-motion/sdk` is `probeMedia`.

## Browser: frame-exact decoding (experimental)

```ts
import { createFrameDecoder } from '@caju-motion/media/web';

const decoder = await createFrameDecoder('/videos/clip.mp4'); // URL, ArrayBuffer or Blob
await decoder.drawFrameAt(ctx, 2.5); // the exact frame shown at 2.5 s
const frame = await decoder.frameAt(2.5); // VideoFrame (call frame.close())
decoder.close();
```

It decodes with WebCodecs from the MP4 itself (no `<video>` element), so `frameAt(t)` returns the same frame FFmpeg would extract, B-frames and edit lists included. Reading forward frame by frame reuses decoded frames, and seeking backwards restarts from the previous keyframe. Limits: MP4/MOV only (H.264, H.265, VP9, AV1), and the whole file is loaded into memory, so use it for clips. Check support with `isWebCodecsSupported()`.
