---
title: Getting started
description: Create a Caju Motion project, open Caju Studio, build a video from code and render it to MP4.
---

# Getting started

From zero to an MP4 in a few minutes: create a project, open the Studio, build from code, render.

## Requirements

| Tool | Version | Why |
|---|---|---|
| Node.js | ≥ 20.11 (22 LTS recommended) | CLI, Studio, `video.ts` |
| npm | ≥ 10 | packages / workspaces |
| Chrome or Edge | recent | Studio, and the headless browser used by `caju render` (or set `CAJU_BROWSER_PATH`) |
| FFmpeg + ffprobe | ≥ 6, optional | Rendering uses a bundled FFmpeg; a system FFmpeg is handy for [preparing assets](./assets) |

Run `npx caju doctor` to check your environment, disk space and memory (see [CLI](../reference/cli#doctor)).

## 1. Create a project

::: info Coming with the first release
`create-caju` and the `caju` packages are ready in the repo but **not on npm yet**. Until the first release, use the [from source](#from-source) path below: every command is the same, prefixed with `npm run caju --`.
:::

```bash
npm create caju@latest my-video
cd my-video
```

The scaffolder asks for a template and whether to install the [agent skills](./ai-agents). Skip the questions with flags:

```bash
npm create caju@latest my-video -- --template reel-legendado --yes
```

| Template | What you get |
|---|---|
| `blank` (default) | A minimal 9:16 reel, to start from scratch |
| `reel-legendado` | 9:16 with a title, captions timed to the voice-over and a name lower third |
| `explainer-16x9` | 16:9 scenes with text, shapes and an animated counter (`CountUp`) |
| `data-video` | 4:5 bar chart (`BarChart`) read from a JSON file |
| `audiograma` | 1:1 podcast audiogram with an animated waveform (`Waveform`) and optional audio |

| Flag | Effect |
|---|---|
| `-t`, `--template <name>` | Pick a template without the prompt |
| `-y`, `--yes` | No questions: folder `meu-video`, template `blank`, installs dependencies and skills |
| `--no-install` | Don't install dependencies |
| `--skills` / `--no-skills` | Install (or skip) the agent skills |
| `--pm <name>` | `npm`, `pnpm`, `yarn` or `bun` (default: the one that ran `create`) |

## 2. Open Caju Studio

```bash
npx caju studio            # http://localhost:3700
```

The Studio lists the projects in `projects/`. Move and trim clips, edit text and colors, change audio volume and fades, drop in [components](./components) from the **Componentes** tab, and export. See [Caju Studio](./studio).

## 3. Write the video in code (optional)

Create `projects/<id>/video.ts`, then build it:

```ts
// projects/hello/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'hello', name: 'Hello', format: 'reel-9x16', background: '#171512', duration: 90 },
  (p) => {
    const { width, height } = p.settings;
    p.scene('intro', 'Intro', 0, 90, (s) => {
      s.text('Hello, Caju', { size: 120, weight: 800, color: '#F6B73C' },
             { id: 'title', x: width / 2, y: height / 2, enter: { at: 0, rise: 40 } });
    });
  },
);
```

```bash
npx caju build hello       # video.ts → projects/hello/project.json
npx caju check hello       # validate: schema, assets on disk, components, determinism
```

Re-running `caju build` regenerates only the clips that came from code and **keeps everything made in the Studio**. See [Video by code](./video-by-code).

## 4. Render

```bash
npx caju render hello      # → projects/hello/renders/hello-<timestamp>.mp4
npx caju still hello --frame 45 --out frame.png
```

Or press **Exportar** in the Studio. Formats, quality and verification: [Rendering](./rendering).

## From source

This works today, before the npm release.

```bash
git clone https://github.com/MardelAraujo/caju_motion.git
cd caju_motion
npm install
npm run studio                                   # Studio at http://localhost:3700 (projects in ./projects)
npm run caju -- new my-video --format reel-9x16  # an empty project
npm run caju -- build exemplo-codigo             # the code example → project.json
npm run build -w @caju-motion/studio             # once, before the first render
npm run caju -- render exemplo-codigo            # → projects/exemplo-codigo/renders/*.mp4
npm run check                                    # typecheck + determinism lint + tests + fixtures
```

Every command accepts `--dir <projectsFolder>` to work on another folder.

## Next steps

- [Project structure](./project-structure): where files go.
- [Concepts](./concepts): `project.json`, frames, tracks and clips, `origin`.
- [Using AI agents](./ai-agents): let Claude Code write videos for you.
