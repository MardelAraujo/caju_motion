---
name: caju-best-practices
description: Router and golden rules for Caju Motion (code + visual timeline video framework, formerly "frame"). Use for ANY task that creates, edits, generates, validates or renders a Caju video project (project.json, assets, audio, Caju Studio, the `caju`/`frame` CLI), then load the specific skill it points to.
version: 0.2.0
---

# Caju Motion: start here

Caju Motion is a video framework where **one JSON document (`project.json`) is the single source of truth**:
- **code** generates it,
- **Caju Studio** (visual timeline editor) edits it,
- the **renderer** draws it frame by frame.

Read this file first, then load only the skill you need.

## Which skill to load

| Task | Skill |
|---|---|
| Install, set up a project, fix environment errors | [caju-setup](../caju-setup/SKILL.md) |
| Add or organize images, video, fonts, data files | [caju-assets](../caju-assets/SKILL.md) |
| Voice-over, music, sound effects, sync, loudness | [caju-audio](../caju-audio/SKILL.md) |
| Write or generate `project.json` (tracks, clips, keyframes, text, layout) | [caju-authoring](../caju-authoring/SKILL.md) |
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
6. **Check, don't guess.** Run the validator and fix every error before you call the work done.

## End-to-end workflow
Step-by-step version in [workflow.md](workflow.md).
1. Set up (caju-setup).
2. Prepare the assets: convert, normalize audio, measure durations (caju-assets, caju-audio).
3. Write `projects/<id>/video.ts` with `defineProject`, plus components in `components/` when needed, then `caju build <id>` (caju-authoring, caju-components). For tiny projects, hand-written `project.json` is fine.
4. Validate with `caju check` and fix errors.
5. Open the Studio and let the user review and adjust (caju-studio). Rebuild with `caju build`: Studio edits are preserved.
6. `caju render <id>` and verify the output (caju-render).

## Availability (v0.2.0)
Packages are named `@caju-motion/*` and the CLI is `caju`, but nothing is published to npm yet: work from a checkout of the repo (`npm run caju -- <command>`). Never invent commands from the **Planned** column.

| Capability | Today (inside the repo checkout) | Planned |
|---|---|---|
| Open the Studio | `npm run studio` → http://localhost:3700 | `npx caju studio` (after the first npm release) |
| New Caju project folder | (repo checkout already is one) | `npm create caju@latest` with 5 templates (after release) |
| New empty project in a folder | `npm run caju -- new <id> --format reel-9x16 [--dir <projectsFolder>]` | — |
| Diagnose environment | `npm run caju -- doctor` | — |
| Install these skills elsewhere | `npm run caju -- skills add --target <dir> [--agents all]` | — |
| Generate by code | `projects/<id>/video.ts` (`defineProject` from `@caju-motion/sdk`) + `npm run caju -- build <id>` | — |
| Custom React components | `components/*.tsx` with `defineComponent` (`@caju-motion/renderer`); hot reload in the Studio | — |
| Embed a video in a React app | `<Player project={json} assetBase="/videos/<id>/" controls />` from `@caju-motion/player` (see the docs site, Reference → @caju-motion/player) | — |
| Validate | `npm run caju -- check [<id>] [--dir <projectsFolder>]` (schema, assets, components, determinism) | — |
| Render video / stills | `npm run caju -- render <id>` / `still <id> --frame N`, or the Studio's Exportar button. Requires a built Studio (`npm run build -w @caju-motion/studio`) | cloud render (F4) |
| Custom fonts | **Not available.** Use `"Plus Jakarta Sans"` or `"Red Hat Display"` | font assets |
| Keyframe editing in the Studio | **Not available** (keyframes play back; write them in code) | timeline keyframe editor |

If a user asks for something marked *Not available*, say so plainly in their language and offer the closest workaround from the relevant skill.
