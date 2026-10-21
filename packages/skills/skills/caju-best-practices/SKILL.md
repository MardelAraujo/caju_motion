---
name: caju-best-practices
description: Router, golden rules, intent interview, review loop and saved preferences for Caju Motion (code + visual timeline video framework, formerly "frame"). Use for ANY task that creates, edits, generates, validates or renders a Caju video project (project.json, STORYBOARD.md, assets, audio, Caju Studio, the `caju`/`frame` CLI), then load the specific skill it points to.
version: 0.2.0
---

# Caju Motion: start here

Caju Motion is a video framework where **one JSON document (`project.json`) is the single source of truth**:
- **code** generates it,
- **Caju Studio** (visual timeline editor) edits it,
- the **renderer** draws it frame by frame.

Read this file first, then load only the skill you need.

## 1. What state is the project in?
Decide this **before** asking the user anything.

| State | Signals | Do |
|---|---|---|
| Existing project with a plan | `projects/<id>/STORYBOARD.md` or `BRIEF.md` exists | **Resume**: read both (and `.caju/preferences.json`), continue from the first frame not `animated`; don't re-interview |
| Edit request on an existing video | "change the title", "make scene 2 faster", "frame 3…" | **Targeted edit**: change only what was named (storyboard frame + scene), rebuild, check, snapshot the changed frames ([review-loop.md](review-loop.md#small-edits)) |
| Project edited in the Studio | `meta.updatedAt` ≠ `meta.createdAt`, or `origin: "editor"` clips | Load [caju-studio](../caju-studio/SKILL.md) first; never overwrite human edits |
| Fresh request | "make a video about…", no project yet | **Intent interview** → `BRIEF.md` ([intent-interview.md](intent-interview.md)), then a workflow below |
| Question or idea | "what can Caju do", "could we…" | Answer or propose; don't build |

## 2. Workflow skills (what kind of video?)
| Request | Skill |
|---|---|
| Faceless explainer from a topic or script (voice + visuals + captions + music) | [caju-explainer](../caju-explainer/SKILL.md) |
| A website or product URL → video with its real screens and brand | [caju-site-to-video](../caju-site-to-video/SKILL.md) |
| A song → visuals cut on the beat | [caju-music-to-video](../caju-music-to-video/SKILL.md) |
| Recorded speech / talking head → captioned reel | [caju-captioned-reel](../caju-captioned-reel/SKILL.md) |
| Look, motion, type, color, transitions (any video) | [caju-creative](../caju-creative/SKILL.md) |

Every build ends with the **review loop** ([review-loop.md](review-loop.md)): `caju check` → `caju snapshot --at-cuts` (look at the image) → fix → one question → render. After approval, offer to save **preferences and a recipe** ([preferences.md](preferences.md)).

## 3. Rules skills (how to do each part)

| Task | Skill |
|---|---|
| Install, set up a project, fix environment errors | [caju-setup](../caju-setup/SKILL.md) |
| Add or organize images, video, fonts, data files | [caju-assets](../caju-assets/SKILL.md) |
| Voice-over, music, sound effects, sync, ducking, loudness | [caju-audio](../caju-audio/SKILL.md) |
| Write or generate `project.json` (tracks, clips, keyframes, transitions, effects, layout), `STORYBOARD.md` | [caju-authoring](../caju-authoring/SKILL.md) |
| Write React code that animates (`@caju-motion/core`) | [caju-components](../caju-components/SKILL.md) |
| The user also edits in the Studio, so don't lose their edits | [caju-studio](../caju-studio/SKILL.md) |
| Export / render / verify the output | [caju-render](../caju-render/SKILL.md) |

## Golden rules
Details in [golden-rules.md](golden-rules.md).
1. **The document is the truth.** Never hand-place pixels outside `project.json`. Validate after every change.
2. **Time is integer frames** at `settings.fps` (default 30). Seconds → frames: `Math.round(s * fps)`.
3. **Deterministic only.** The same frame must always produce the same pixels: no `Math.random`, `Date`, timers or CSS transitions.
4. **Never destroy Studio edits.** If `meta.updatedAt` exists and differs from `meta.createdAt`, a human saved the project in the Studio. See caju-studio.
5. **Assets live inside the project folder** and are referenced by relative `src` (`assets/...`).
6. **Check, then look.** Run `caju check` and fix every error, then `caju snapshot` and look at the sheet before you call the work done.

## End-to-end workflow
Step-by-step version in [workflow.md](workflow.md).
1. Set up (caju-setup). Read `.caju/preferences.json`; for a fresh request, run the intent interview and write `BRIEF.md` + `STORYBOARD.md`.
2. Prepare the assets: convert, normalize audio, measure durations (caju-assets, caju-audio).
3. Write `projects/<id>/video.ts` with `defineProject`, plus components in `components/` when needed, then `caju build <id>` (caju-authoring, caju-components). For tiny projects, hand-written `project.json` is fine.
4. Validate with `caju check` and fix errors; `caju snapshot <id> --at-cuts` and look ([review-loop.md](review-loop.md)).
5. Open the Studio and let the user review and adjust (caju-studio). Rebuild with `caju build`: Studio edits are preserved.
6. `caju render <id>` and verify the output (caju-render).

## Availability (v0.2.0)
Packages are named `@caju-motion/*` and the CLI is `caju`, but nothing is published to npm yet: work from a checkout of the repo (`npm run caju -- <command>`). Never invent commands from the **Planned** column.

| Capability | Today (inside the repo checkout) | Planned |
|---|---|---|
| Open the Studio | `npm run studio` → http://localhost:3700 | `npx caju studio` (after the first npm release) |
| New Caju project folder | (repo checkout already is one) | `npm create caju@latest` with 5 templates (after release) |
| New empty project in a folder | `npm run caju -- new <id> --format reel-9x16 [--dir <projectsFolder>]` | — |
| Diagnose environment | `npm run caju -- doctor [--json]` | — |
| Install these skills elsewhere | `npm run caju -- skills add --target <dir> [--agents all]` | — |
| Generate by code | `projects/<id>/video.ts` (`defineProject` from `@caju-motion/sdk`) + `npm run caju -- build <id>` | — |
| Custom React components | `components/*.tsx` with `defineComponent` (`@caju-motion/renderer`); hot reload in the Studio | — |
| Embed a video in a React app | `<Player project={json} assetBase="/videos/<id>/" controls />` from `@caju-motion/player` (see the docs site, Reference → @caju-motion/player) | — |
| Fill asset metadata, thumbnails, waveforms, editing proxies | `npm run caju -- media [<id>] [--proxies auto]` | — |
| Voice-over (TTS) + captions | `npm run caju -- tts <id> --text "..." [--provider voicestudio\|placeholder\|openai\|elevenlabs] [--model engine] [--voice v] [--seed n]` (default `voicestudio`: local and free, but the user must install and open the VoiceStudio app, check with `caju doctor`; `placeholder` is free too; `openai`/`elevenlabs` need `OPENAI_API_KEY`/`ELEVENLABS_API_KEY` and cost the user money: ask first). Voices: `npm run caju -- voices [--json]`. Captions for recorded speech: `npm run caju -- transcribe <id> --from video.mp4 --captions`. Import SRT/VTT: `npm run caju -- captions <id> --from file.srt`. In code: `s.captions(cues, style, el)` (caju-audio → voiceover-timing) | — |
| Validate | `npm run caju -- check [<id>] [--dir <projectsFolder>] [--json]` (schema, assets, components, determinism, `CAJU_*` lint) | — |
| Look at key frames | `npm run caju -- snapshot <id> [--at-cuts] [--frames 0,45,90] [--cols 4] [--resolution 540] [--out file] [--json]` → `boards/snapshot.png` + `.json` | — |
| Capture a website | `npm run caju -- capture <url> --project <id> [--width 1440] [--height 900]` → `assets/capture/` (screenshots, tokens, text, images) | — |
| Beat grid of a song | `npm run caju -- beats <audio-file> [--project <id>] [--out file]` → `assets/data/<name>.beats.json` | — |
| What exists (poses, loops, effects, overlays, components, templates) | `npm run caju -- catalog [--query "text"] [--kind transition\|loop\|effect\|overlay\|component\|template] [--json]` | — |
| Transitions, animations, loops, effects, overlays, adjustment layers | ✓ in preview and export (caju-authoring → motion.md) | masks |
| Ducking + loudness in the export, volume keyframes, track roles | ✓ `settings.audio` (caju-audio → mixing.md) | — |
| Render video / stills | `npm run caju -- render <id>` / `still <id> --frame N`, or the Studio's Exportar button. Requires a built Studio (`npm run build -w @caju-motion/studio`) | cloud render (F4) |
| Custom fonts | **Not available.** Use `"Plus Jakarta Sans"` or `"Red Hat Display"` | font assets |
| Keyframe editing in the Studio | **Not available** (keyframes play back; write them in code) | timeline keyframe editor |

If a user asks for something marked *Not available*, say so plainly in their language and offer the closest workaround from the relevant skill.
