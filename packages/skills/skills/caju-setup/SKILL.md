---
name: caju-setup
description: Install and set up Caju Motion and diagnose environment problems (npm create caju, caju doctor, caju skills add). Use when the user wants to install Caju, start a new video project, open Caju Studio, or hits errors with Node, npm, ffmpeg, the render browser, ports, memory/disk or Windows/macOS/Linux paths.
version: 0.2.0
---

# Caju setup

## Requirements
| Tool | Version | Why | Check |
|---|---|---|---|
| Node.js | ≥ 20.11 (22 LTS recommended) | Studio, CLI, `video.ts` | `node -v` |
| npm (or pnpm/yarn/bun) | recent | install packages | `npm -v` |
| Chrome or Edge | recent | Studio, render (headless), eyedropper | — |
| FFmpeg + ffprobe | optional | **asset preparation** only (convert, loudness, durations). Render uses the bundled FFmpeg | `ffmpeg -version` |

Render needs no browser download: it uses an installed Chrome or Edge (or `CAJU_BROWSER_PATH`) and the bundled FFmpeg (or `CAJU_FFMPEG_PATH`). Plan for about 1 GB of free RAM and a few GB of disk for renders.

**`caju doctor` checks all of this** and prints a ✓/!/✗ list with fixes:
- Node, npm and FFmpeg;
- the browser used for render;
- whether the Studio app is built;
- projects and components;
- disk, memory and write permission.

It exits with code 1 if something blocks. **Run it first whenever something fails.**

## New project (recommended)
> Packages go to npm with the first release. Until then, use the repo checkout below.
```bash
npm create caju@latest my-video          # asks for template, installs deps, adds agent skills
cd my-video
npm run dev                               # = caju studio --open
```
- Non-interactive: `npm create caju@latest my-video -- --template explainer-16x9 --yes`.
- Flags: `-t/--template`, `-y/--yes`, `--no-install`, `--skills`/`--no-skills`, `--pm npm|pnpm|yarn|bun`.
- Templates:

  | Template | Format | What it shows |
  |---|---|---|
  | `blank` | 9:16 | minimal title scene (`projects/meu-video`) |
  | `reel-legendado` | 9:16 | title, captions timed from voice-over durations, `LowerThird` |
  | `explainer-16x9` | 16:9 | three scenes with shapes, step cards, `CountUp` |
  | `data-video` | 4:5 | `BarChart` component fed by `assets/data/*.json` |
  | `audiograma` | 1:1 | `Waveform` component + progress, optional audio |

- The generated project has scripts `dev`, `build` (`caju build`), `check`, `render`, `still` and `doctor`, plus `AGENTS.md`/`CLAUDE.md` pointing agents to these skills.
- Folder layout: `projects/<id>/{video.ts, project.json, assets/}`, `components/`, `renders/` (ignored), `.caju/` (ignored except `last-build.json`).

## Agent skills in any project
`npx caju skills add [--target .] [--agents claude|all]`
- It copies the skills to `.claude/skills/` and, with `all`, keeps a marked block in `AGENTS.md`.
- It is idempotent: run it again after upgrading Caju.

## From source (contributors, or before the first release)
```bash
git clone https://github.com/MardelAraujo/caju_motion.git
cd caju_motion
npm install
npm run check                          # typecheck + lint + tests + fixtures + docs: must be green
npm run studio                         # Studio in dev mode (Vite) at http://localhost:3700
npm run build -w @caju-motion/studio   # once before rendering (and after Studio changes)
```
- In the checkout, run commands as `npm run caju -- <command>`, e.g. `npm run caju -- doctor`.
- Every command accepts `--dir <projectsFolder>`, and `studio`/`check`/`render` accept `--components <dir>`.
- Formats: `reel-9x16`, `feed-4x5`, `square-1x1`, `landscape-16x9`.
- `npx caju …` works inside a project that has the packages installed. Outside a project, use `npx caju@latest …` after the release.

## Before reporting success, verify
1. `caju doctor` shows no ✗.
2. `caju check` lists the projects with ✓.
3. The Studio opens and shows the "caju studio" top bar.

Troubleshooting: [troubleshooting.md](troubleshooting.md).
