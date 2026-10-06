---
title: Concepts
description: The mental model of Caju Motion - project.json as the single source of truth, integer frames, tracks and clips, origin code vs editor, and deterministic rendering.
---

# Concepts

## One document, three writers

A video is **one JSON document, `project.json`**:

- **code** generates it (`video.ts` + `defineProject`, then `caju build`);
- **Caju Studio** edits it on a multi-track timeline;
- the **renderer** draws it frame by frame with React. The same code runs in the preview and in the export.

Anything not in the document will not appear in the video.

```text
video.ts ──caju build──▶ project.json ◀──save── Caju Studio
                              │
                              ▼
                 renderer (React, frame N) ──▶ caju render ──▶ MP4
```

## Frames, not seconds

- Every time value is an **integer frame** at `settings.fps` (30 by default): `start`, `duration`, `trimIn`, keyframe `frame`, audio `fadeIn`/`fadeOut`, marker `frame`.
- Seconds → frames: `Math.round(seconds * fps)` (`p.sec(seconds)` in `video.ts`). For audio, use `Math.ceil` so the tail is never cut.
- A clip is active on the half-open interval `[start, start + duration)`.
- **Keyframe frames are relative to the clip start**, so moving a clip moves its animation. They must satisfy `0 <= frame < duration`.

## Project, tracks, clips

| Level | Holds |
|---|---|
| Project | `settings` (format, width, height, fps, background, optional duration), `assets[]`, `tracks[]`, `markers[]`, `meta` |
| Track | `kind` (`main`, `overlay`, `text`, `audio`), `clips[]`, `locked`/`hidden`/`muted` |
| Clip | `type`, `start`, `duration`, `transform`, `opacity`, `blendMode`, `props`, `keyframes`, `audio`, `origin` |

- Tracks stack **bottom → top**: `tracks[0]` is drawn first (the back).
- **Clips on one track never overlap.** Things that coexist in time go on separate tracks.
- Audio clips only on `audio` tracks, and audio tracks only hold audio.
- Clip types that render: `text`, `shape`, `image`, `video`, `audio`, `component`. (`effect` and `adjustment` are accepted by the schema but render nothing yet.)

Full field list: [project.json schema](../reference/project-json).

## `origin`: code vs. editor

| `origin` | Made by | On `caju build` |
|---|---|---|
| `"code"` | `video.ts` (or another generator) | Regenerated. If a human edited it in the Studio, the build stops and reports a **conflict** |
| `"editor"` (default) | Caju Studio | **Kept** |

A project was **edited by a human** when `meta.updatedAt` exists and differs from `meta.createdAt`. The Studio rewrites `updatedAt` on every save; generators never write either field. Details: [Caju Studio](./studio).

## Determinism

The renderer may draw frame 900 before frame 10, in parallel browser tabs, and re-render any frame at any time. So **pixels depend only on `(project, frame)`**:

| Banned in render code | Use instead |
|---|---|
| `Math.random()` | `random(seed)` / `randomRange(seed, min, max)` |
| `Date.now()`, `new Date()`, `performance.now()` | the frame (`useFrame()`) |
| `setTimeout`, `setInterval`, `requestAnimationFrame` | the frame |
| CSS `transition` / `animation` / `@keyframes` | `interpolate()` / `spring()` |
| `Intl.*` formatting | manual formatting (machine locales differ) |

`caju check` runs the determinism lint on your `components/`; in the repo, `npm run lint` does it for the packages. A justified exception takes a `frame-lint-allow` comment on the same line.

## Formats

| Format | Size | fps |
|---|---|---|
| `reel-9x16` | 1080×1920 | 30 |
| `feed-4x5` | 1080×1350 | 30 |
| `square-1x1` | 1080×1080 | 30 |
| `landscape-16x9` | 1920×1080 | 30 |

Each format has safe areas: see [Formats & safe areas](../reference/formats).
