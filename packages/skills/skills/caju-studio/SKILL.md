---
name: caju-studio
description: Coexist with humans editing in Caju Studio (the visual timeline editor) without losing their work. Covers origin code vs editor clips, meta.updatedAt, regenerating projects safely, backups and history, and what the Studio can and cannot edit. Use before regenerating or rewriting any project.json that may have been opened or saved in the Studio.
version: 0.1.0
---

# Working alongside Caju Studio

## Signals in the document
- **Human-edited** = `meta.updatedAt` is present **and** (`meta.createdAt` is missing **or** differs from `updatedAt`).
  - The Studio rewrites `updatedAt` on every save.
  - `caju new` writes `createdAt === updatedAt`, which means untouched.
  - Generator scripts write neither field.
- `origin: "code"` → the clip was created by a generator. `origin: "editor"` (the default) → created in the Studio.
- `.caju/history/<timestamp>.json` holds a snapshot of the previous version, written on every Studio save (older projects may still have `.frame/history/`).

## Before (re)generating a project
1. Read `projects/<id>/project.json`, if it exists.
2. Not human-edited (see above)? Safe to regenerate.
   - `guardOverwrite()` currently refuses any file with `updatedAt`, including a fresh `caju new` project.
   - For an untouched project, pass `--force` (it only makes a backup), or skip `caju new` and let the generator create the folder.
3. Human-edited? **Stop and ask the user** (in their language), e.g.: "Este projeto foi editado no Studio em <data>. Regenerar apaga essas edições. Quer que eu (a) aplique só a mudança pedida no JSON atual, (b) regenere e descarte as edições (com backup), ou (c) cancele?"
4. Prefer **(a) surgical edits** to the existing JSON: change only the clips or fields involved and keep everything else byte-for-byte.
5. Choosing (b) means `guardOverwrite(dir, root, true)` from `scripts/examples/builder.ts`, which first copies the file to `<root>/.cache/backups/<id>-<updatedAt>.json`.

## While the Studio is open
- The Studio checks the file on disk every 4 s.
  - With no unsaved edits, it reloads by itself.
  - With unsaved edits, it warns, and the human chooses at save time.
- Avoid rewriting the file while the user is actively editing. Tell them first.

## What the Studio edits (so you can delegate)
- Can edit:
  - moving, trimming and splitting clips;
  - position, scale, rotation and flip;
  - text and colors (full RGB/alpha picker with eyedropper);
  - shape width and height;
  - opacity;
  - audio volume and fades;
  - speed;
  - project format and background.
- **Cannot edit keyframes yet:** existing ones play back, and dragging an element offsets all its position keyframes.
- So: the agent writes the structure and animation; the human polishes placement, copy and timing.

## Planned (F2)
`caju build` merges per origin: it regenerates `code` clips, keeps `editor` clips, and shows a diff when a code clip was hand-edited.
