---
title: Caju Studio
description: Caju Studio, the visual timeline editor - what it edits, how caju build merges code and Studio edits, conflicts, history and working alongside a running Studio.
---

# Caju Studio

Caju Studio is the visual timeline editor. It opens the same `project.json` that code generates, and saves back to it.

```bash
npx caju studio [--dir projects] [--port 3700] [--open]
```

Then open `http://localhost:3700`. The Studio lists every project in the folder.

## What you can edit

| Area | In the Studio |
|---|---|
| Timeline | move, trim and split clips across a multi-track timeline |
| Transform | position, scale, rotation, flip |
| Text and color | text, fonts, colors (RGB/alpha picker with eyedropper in Chrome/Edge) |
| Shapes | width and height |
| Clip | opacity, speed |
| Audio | volume and fades |
| Components | props, via a form generated from the component's zod schema ([Components](./components)) |
| Project | format and background |
| Export | the **Exportar** button ([Rendering](./rendering)) |

**Not yet:** keyframe editing. Existing keyframes play back, and dragging an element offsets all its position keyframes. A good split: code (or an agent) writes structure and animation; humans polish placement, copy and timing.

## How edits are tracked

- `origin: "code"` marks clips from `video.ts`; `origin: "editor"` (the default) marks clips made in the Studio.
- **Human-edited project:** `meta.updatedAt` is present and `meta.createdAt` is missing or different. The Studio rewrites `updatedAt` on every save; `caju new` writes both with the same value; generators write neither.
- `.caju/history/*.json` keeps the previous version, written on every Studio save and every `caju build`.
- `.caju/last-build.json` keeps the raw output of the last build: the baseline for detecting Studio edits to code clips. **Commit it.**

## Merging: `caju build` {#conflicts}

For projects with `video.ts`, `caju build <id>` runs the code and **merges** with what is on disk:

| Clip | What happens |
|---|---|
| Created in the Studio (`origin: "editor"`) | **Kept**. It stays on its track, or moves to a new "Edições do Studio" track if its track is gone or the space is taken |
| From code, untouched in the Studio | Replaced by the new generated version |
| From code, **edited in the Studio** (differs from `last-build.json`) | **Conflict**: nothing is written; the diff is printed (clip id + fields) |
| From code, deleted in the Studio | Conflict ("removed") |
| Created by splitting a code clip in the Studio | Kept as an editor clip |

Assets, markers and tracks added in the Studio are kept too.

When there are conflicts, pick one:

1. **Move the human change into `video.ts`** (same value, stable `id`), then rebuild. Usually best.
2. `caju build <id> --force`: the code wins; the previous file goes to `.caju/history/`.
3. Leave the project as it is.

`caju build --dry-run` shows what would change without writing. Without `last-build.json` (fresh clone or first build) edits to code clips can't be detected: the build warns and replaces them, keeping a copy in history. Editor clips are always safe.

## Projects without `video.ts`

For hand-written JSON or legacy scripts, prefer **surgical edits**: change only the clips or fields involved. Before regenerating a human-edited project with a standalone script, ask; `guardOverwrite()` refuses to overwrite without `--force`, and with it backs up to `<root>/.cache/backups/`.

## While the Studio is open

- The Studio checks the file on disk every 4 s. With no unsaved edits it reloads by itself; with unsaved edits it warns ("o projeto mudou no disco") and the human chooses at save time.
- Avoid rewriting `project.json` while someone is actively editing.
- Files in `components/` hot-reload without a page reload.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE` / port 3700 busy | close the other Studio, or `npx caju studio --port 3701` |
| Blank page on first load | fonts block the first paint; wait 2–3 s or hard-reload |
| Eyedropper disabled | use Chrome or Edge (EyeDropper API) |
