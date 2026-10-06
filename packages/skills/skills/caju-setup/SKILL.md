---
name: caju-setup
description: Install and set up Caju Motion (formerly "frame") and diagnose environment problems. Use when the user wants to install Caju, start a new video project, open Caju Studio, or hits errors with Node, npm, ffmpeg, ports, Chrome or Windows/macOS/Linux paths.
version: 0.2.0
---

# Caju setup

## Requirements
| Tool | Version | Why | Check |
|---|---|---|---|
| Node.js | ≥ 20 (22 LTS recommended) | Studio, CLI, scripts | `node -v` |
| npm | ≥ 10 | workspaces | `npm -v` |
| Git | any | get the source | `git --version` |
| FFmpeg + ffprobe | ≥ 6 (on PATH) | preparing assets (convert, loudness, durations) | `ffmpeg -version` |
| Chrome / Edge | recent | Studio, single-frame capture, eyedropper | — |

Rendering uses the bundled FFmpeg (`ffmpeg-static`, or `CAJU_FFMPEG_PATH`) and an installed Chrome or Edge (or `CAJU_BROWSER_PATH`); no browser download is needed. A system FFmpeg/ffprobe is still useful for **asset preparation**. Before the first render from a repo checkout, run `npm run build -w @caju-motion/studio` (and again after Studio changes).

## Install (today: from source)
```bash
git clone <caju-repo-url> caju
cd caju
npm install
npm run check        # typecheck + determinism lint + tests + fixtures: must be green
npm run studio       # http://localhost:3700
```
- Projects live in `projects/<id>/` by default. **Every command accepts `--dir <projectsFolder>`** to use another folder (absolute or relative to the repo root):
  - `npm run caju -- studio --dir <folder> [--port 3701]`
  - `npm run caju -- new <id> --format reel-9x16 --dir <folder>`
  - `npm run caju -- check [<id>...] --dir <folder>`
- Formats: `reel-9x16`, `feed-4x5`, `square-1x1`, `landscape-16x9`.

## Install (planned, F3; do not use yet)
`npm create caju-motion@latest my-video` → `cd my-video` → `npm run dev` (= `caju studio`). Then `npx caju skills add` installs these skills into `.claude/skills/`. Without a project, `npx @caju-motion/cli studio` (never bare `npx caju`, which would fetch an unrelated package).

## Before reporting success, verify
1. `npm run check` passes.
2. `npm run studio` prints the URL and the page shows the "caju studio" top bar.
3. `npm run caju -- check` lists the projects with ✓.

Troubleshooting: [troubleshooting.md](troubleshooting.md).
