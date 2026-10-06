---
name: caju-studio
description: Coexist with humans editing in Caju Studio (the visual timeline editor) without losing their work. Covers origin code vs editor clips, caju build merge and conflicts, meta.updatedAt, history and backups, and what the Studio can and cannot edit. Use before regenerating or rewriting any project.json that may have been opened or saved in the Studio.
version: 0.2.0
---

# Working alongside Caju Studio

## Signals in the document
- `origin: "code"`: the clip came from `video.ts` (or another generator). `origin: "editor"` (the default): the clip was made in the Studio.
- **Human-edited project:** `meta.updatedAt` is present **and** (`meta.createdAt` is missing **or** differs from it). The Studio rewrites `updatedAt` on every save.
- History:
  - `.caju/history/*.json` holds the previous version, written on every Studio save and every `caju build` (older projects may have `.frame/history/`).
  - `.caju/last-build.json` holds the raw output of the last build. It is the baseline for detecting Studio edits to code clips, so **keep it in git**.

## Projects with `video.ts`: use `caju build` (safe by design)
`caju build <id>` runs `video.ts` and **merges**:

| Clip | What happens |
|---|---|
| Created in the Studio (`origin: "editor"`) | **Kept.** It stays on its track, or moves to a new "Edições do Studio" track if its track is gone or the space is now taken |
| From code, untouched in the Studio | Replaced by the new generated version |
| From code, **edited in the Studio** (differs from `last-build.json`) | **Conflict:** nothing is written. The diff is printed (clip id + fields) |
| From code, deleted in the Studio | Conflict ("removed") |
| Created by splitting a code clip in the Studio | Kept as an editor clip |

Assets, markers and tracks added in the Studio are kept too.

When there are conflicts, show the diff to the user in their language and ask. Typical options:
- **(a)** Move the human change into `video.ts`: same value, stable `id`. Then rebuild. This is usually best.
- **(b)** `caju build <id> --force`: the code wins. The previous file goes to `.caju/history/`.
- **(c)** Leave the project as it is.

`caju build --dry-run` shows what would change without writing.
Without `last-build.json` (fresh clone or first build), edits to code clips can't be detected. The build warns and replaces them, keeping a copy in history. Editor clips are always safe.

## Projects without `video.ts` (hand-written or legacy scripts)
- Prefer **surgical edits** to the existing JSON: change only the clips or fields involved and keep everything else as it is.
- Before regenerating a human-edited project with a standalone script, **ask the user**. `guardOverwrite(dir, root, force)` refuses to overwrite without `--force`, and with `--force` it backs up to `<root>/.cache/backups/`.

## While the Studio is open
- The Studio checks the file on disk every 4 s.
  - With no unsaved edits, it reloads by itself.
  - With unsaved edits, it warns, and the human chooses at save time.
- Avoid rewriting `project.json` while the user is actively editing. Tell them first.
- Files in `components/` hot-reload in the Studio without a page reload.

## What the Studio edits (so you can delegate)
- Can edit:
  - moving, trimming and splitting clips;
  - position, scale, rotation and flip;
  - text and colors (full RGB/alpha picker with eyedropper);
  - shape width and height;
  - opacity;
  - audio volume and fades;
  - speed;
  - **component props** (form generated from the component's schema);
  - project format and background;
  - **export** (Exportar button).
- **Cannot edit keyframes yet:** existing ones play back, and dragging an element offsets all its position keyframes.
- So: the agent writes the structure and animation (and components); the human polishes placement, copy and timing.
