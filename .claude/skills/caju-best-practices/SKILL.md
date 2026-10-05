---
name: caju-best-practices
description: Router and golden rules for Caju Motion (code + visual timeline video framework, formerly "frame"). Use for ANY task that creates, edits, generates, validates or renders a Caju video project (project.json, assets, audio, Caju Studio, the `caju`/`frame` CLI), then load the specific skill it points to.
version: 0.1.0
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
1. Set up (caju-setup), then create the project folder.
2. Prepare the assets: convert, normalize audio, measure durations (caju-assets, caju-audio).
3. Write the generator script or the `project.json` (caju-authoring).
4. Validate with `check` and fix errors.
5. Open the Studio and let the user review and adjust (caju-studio).
6. Render and verify the output (caju-render).

## Availability (v0.1.0)
Packages are named `@caju-motion/*` and the CLI is `caju`, but nothing is published to npm yet: work from a checkout of the repo. Use the **Today** column. Never invent commands from the **Planned** column.

| Capability | Today (inside the repo checkout) | Planned |
|---|---|---|
| Open the Studio | `npm run studio` → http://localhost:3700 | `npx @caju-motion/cli studio` (after the first npm release) |
| New empty project | `npm run caju -- new <id> --format reel-9x16 [--dir <projectsFolder>]` (skip it when a generator script creates the project) | `npx caju new` (after release) |
| Validate | `npm run caju -- check <id> [--dir <projectsFolder>]` | `npx caju check` (after release) |
| Generate by code | TS script using `ProjectBuilder` from `scripts/examples/builder.ts`, run with `npx tsx` | `defineProject` + `caju build` (F2) |
| Render MP4 | **Not available.** Single-frame PNG only, via headless Chrome on `?render=` | `caju render` / `caju still` (F1) |
| React component clips | **Not available** (`type: "component"` renders nothing) | `defineComponent` (F2) |
| Custom fonts | **Not available.** Use `"Red Hat Display"` or `"Plus Jakarta Sans"` | font assets (F2) |
| Packages import name | `@caju-motion/schema`, `@caju-motion/core`, `@caju-motion/renderer` | — |

If a user asks for something marked *Not available*, say so plainly in their language and offer the closest workaround from the relevant skill.
