---
name: caju-authoring
description: Write or generate Caju Motion project.json documents (settings, tracks, clips, text, shapes, images, keyframes, easing, transitions, entrance/exit/loop animations, effects, overlays, adjustment layers, markers, formats and safe areas), by hand or with a TypeScript generator script, and plan them in STORYBOARD.md. Use when creating a new Caju video from a brief/script, adding scenes or animations, or fixing check validation errors and CAJU_* lint warnings.
version: 0.2.0
---

# Authoring Caju videos

## Mental model
- **Project:** `settings` (format, size, fps, background, optional duration) + `assets[]` + `tracks[]` + `markers[]`.
- **Tracks** stack bottom → top: `tracks[0]` is drawn first, so it is the back.
  - Kinds: `main`, `overlay`, `text`, `audio` (`effect` is accepted; use `overlay` tracks for effect clips).
  - Audio tracks may carry a `role` (`voice`, `music`, `sfx`) for the mix (caju-audio).
- **Clips** live on tracks. Types:
  - `text`, `shape`, `image`, `video`, `audio`;
  - `component`: custom React components (caju-components);
  - `effect`: a full-frame overlay (vignette, letterbox, colorOverlay, flash, grain);
  - `adjustment`: applies its effects to every layer below it.
- Every clip has `start` + `duration` (frames), a `transform` (anchor position x/y in project px, plus scale, rotation, anchor and flips), `opacity`, `blendMode`, `props` (type-specific) and `keyframes` (animation).
- Motion presets on any visual clip: `transitionIn/Out`, `animationIn/Out/Loop` and `effects[]` (CSS filters). They render in preview and export ([motion.md](motion.md)).

## Rules
- [project-json.md](project-json.md): the full document reference, a complete valid example and the validation rules that `check` enforces.
- [elements.md](elements.md): props for text, shape, image and video; layout; safe areas per format.
- [animation.md](animation.md): keyframes, easing presets, entrance/exit recipes, keeping the JSON small.
- [motion.md](motion.md): transitions, entrance/exit/loop animations, effects, overlay and adjustment clips, with params, examples and the `CAJU_*` lint codes.
- [storyboard.md](storyboard.md): the `STORYBOARD.md` plan format (frames, status, voice-over, on-screen text, transitions).
- [generator-script.md](generator-script.md): generating projects in TypeScript with `video.ts` + `defineProject` + `caju build` (Studio edits are preserved).

## Process
1. Write or read `STORYBOARD.md` ([storyboard.md](storyboard.md)). Pick the format and compute the scene timing first (from the VO when there is one; see caju-audio).
2. Register the assets (caju-assets).
3. Before hand-authoring a named look (a transition, a lower third, a counter), run `npm run caju -- catalog --query "<look>"`: use the built-in pose/effect or an existing component when one fits.
4. Generate the document. Prefer a script for anything with more than about 10 clips.
5. `npm run caju -- check <id>`, then fix every error and weigh every `CAJU_*` warning ([motion.md](motion.md#lint-codes-caju-check)).
6. `npm run caju -- snapshot <id> --at-cuts` and look at the sheet (caju-best-practices → review-loop).

## Availability (v0.2.0)
| Feature | Today | Planned |
|---|---|---|
| text / shape / image / video / audio clips | ✓ | — |
| keyframes on `opacity`, `transform.*`, `props.*` (numbers and hex colors) | ✓ | — |
| `transitionIn/Out`, `animationIn/Out/Loop`, `effects[]`, `effect` and `adjustment` clips | ✓ ([motion.md](motion.md)) | — |
| Masks, custom transition shaders | **Not available** | later |
| `component` clips (custom React) | ✓ `components/*.tsx` + `defineComponent` (caju-components) | — |
| Generator API | `video.ts` + `defineProject` (`@caju-motion/sdk`) + `caju build` | — |
