# Caju skills (agent skills)

Skills that teach coding agents (Claude Code and other Agent Skills–compatible tools) to install Caju Motion and to generate videos correctly: asset structure, audio, `project.json`, animation, Studio coexistence and rendering.

| Skill | Role |
|---|---|
| `caju-best-practices` | Router: project state, intent interview (`BRIEF.md`), review loop, preferences/recipes, golden rules |
| `caju-creative` | House style, motion principles, typography, palettes, transitions |
| `caju-explainer` | Workflow: faceless explainer with generated voice-over |
| `caju-site-to-video` | Workflow: website/product URL → video (`caju capture`) |
| `caju-music-to-video` | Workflow: beat-synced video from a song (`caju beats`) |
| `caju-captioned-reel` | Workflow: captions from recorded speech (`caju transcribe`) |
| `caju-setup` | Install, environment, troubleshooting |
| `caju-assets` | Folder structure, image/video/font preparation, asset registration |
| `caju-audio` | VO, music, SFX, loudness, ducking, narration-driven timing |
| `caju-authoring` | `project.json` reference, elements, keyframes/easing, motion presets and effects, storyboard, generator scripts |
| `caju-components` | Deterministic frame-driven React with the core runtime |
| `caju-studio` | Never lose Studio edits when regenerating |
| `caju-render` | Export settings, stills, verifying output |

## Format
Each skill is a folder with a `SKILL.md` and rule files next to it. `SKILL.md` frontmatter has `name` (same as the folder), `description` (when to trigger, ≤ 1024 chars) and `version` (the Caju version). The rule files are loaded on demand through relative links.

## Install
- **In this repo (today):** `npm run skills:install` copies them to `.claude/skills/`.
- **Planned (F3):** `npx caju skills add` in any project; `create-caju-motion` offers it; mirror repo for `npx skills add`.

## Keeping them correct
`npm run test` (part of `npm run check`) validates:
- frontmatter and relative links;
- every ` ```json caju-project ` block against the real schema (`parseProject`);
- every ` ```ts caju-check ` / ` ```tsx caju-check ` block with the TypeScript compiler, against the real packages.

When a roadmap phase ships, update each skill's **Availability** table and bump `version`.
