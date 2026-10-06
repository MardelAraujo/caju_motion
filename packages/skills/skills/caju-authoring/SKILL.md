---
name: caju-authoring
description: Write or generate Caju Motion project.json documents (settings, tracks, clips, text, shapes, images, keyframes, easing, markers, formats and safe areas), by hand or with a TypeScript generator script. Use when creating a new Caju video from a brief/script, adding scenes or animations, or fixing check validation errors.
version: 0.2.0
---

# Authoring Caju videos

## Mental model
- **Project:** `settings` (format, size, fps, background, optional duration) + `assets[]` + `tracks[]` + `markers[]`.
- **Tracks** stack bottom → top: `tracks[0]` is drawn first, so it is the back.
  - Kinds: `main`, `overlay`, `text`, `audio`.
  - `effect` exists in the schema but is not rendered yet.
- **Clips** live on tracks.
  - Types that render today: `text`, `shape`, `image`, `video`, `audio`.
  - `component` renders custom React components (caju-components). `effect` and `adjustment` are valid in the schema but **render nothing yet**. Don't use them.
- Every clip has `start` + `duration` (frames), a `transform` (anchor position x/y in project px, plus scale, rotation, anchor and flips), `opacity`, `blendMode`, `props` (type-specific) and `keyframes` (animation).

## Rules
- [project-json.md](project-json.md): the full document reference, a complete valid example and the validation rules that `check` enforces.
- [elements.md](elements.md): props for text, shape, image and video; layout; safe areas per format.
- [animation.md](animation.md): keyframes, easing presets, entrance/exit recipes, keeping the JSON small.
- [generator-script.md](generator-script.md): generating projects in TypeScript with `video.ts` + `defineProject` + `caju build` (Studio edits are preserved).

## Process
1. Pick the format and compute the scene timing first (from the VO when there is one; see caju-audio).
2. Register the assets (caju-assets).
3. Generate the document. Prefer a script for anything with more than about 10 clips.
4. `npm run caju -- check <id>`, then fix everything.
5. Open the Studio to review.

## Availability (v0.2.0)
| Feature | Today | Planned |
|---|---|---|
| text / shape / image / video / audio clips | ✓ | — |
| keyframes on `opacity`, `transform.*`, `props.*` (numbers and hex colors) | ✓ | — |
| `transitionIn/Out`, `animationIn/Out/Loop`, `effects`, masks | stored, **not rendered** | F3+ |
| `component` clips (custom React) | ✓ `components/*.tsx` + `defineComponent` (caju-components) | — |
| Generator API | `video.ts` + `defineProject` (`@caju-motion/sdk`) + `caju build` | — |
