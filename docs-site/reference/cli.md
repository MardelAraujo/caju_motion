---
title: CLI
description: Reference for the caju command - studio, new, build, check, render, still, doctor and skills add - with every flag, plus create-caju.
---

# CLI

The `caju` command comes from `@caju-motion/cli` (`caju-motion` is an alias). The short package `caju` makes `npx caju <command>` work without installing anything.

::: info Coming with the first release
The packages are not on npm yet. From a repo checkout, run the same commands as `npm run caju -- <command>` (and `npm run studio` for the Studio in dev mode).
:::

```text
caju <command> [args] [--flags]
caju --help | -h
caju --version | -v
```

## Commands

| Command | What it does |
|---|---|
| `caju studio` | opens Caju Studio in the browser |
| `caju new <id>` | creates an empty project |
| `caju build [ids...]` | generates `project.json` from `video.ts`, keeping Studio edits |
| `caju check [ids...]` | validates projects: schema, assets on disk, components, determinism |
| `caju render <id>` | exports a video (Chromium + FFmpeg) |
| `caju still <id> --frame <n>` | exports one frame as an image |
| `caju doctor` | checks your environment |
| `caju skills add` | installs the agent skills |

### `caju studio`

```bash
caju studio [--dir projects] [--port 3700] [--open] [--components <dir>]
```

| Flag | Default | Meaning |
|---|---|---|
| `--dir` | `projects` | projects folder |
| `--port` | `3700` | HTTP port |
| `--open` | off | open the browser |
| `--components` | `<dir>/../components` | components folder |
| `--dev` | off | Studio development mode with Vite/HMR (repo checkout only) |

### `caju new`

```bash
caju new <id> [--format reel-9x16] [--dir projects]
```

Creates `<dir>/<id>/project.json` and `assets/`. `--format`: `reel-9x16` (default), `feed-4x5`, `square-1x1`, `landscape-16x9`. Not needed for code-first projects: `caju build` creates the file.

### `caju build`

```bash
caju build [ids...] [--dir projects] [--force] [--dry-run]
```

Runs `<dir>/<id>/video.ts` (`defineProject`) and merges into `project.json`. Without ids, builds every project that has a `video.ts`.

| Flag | Meaning |
|---|---|
| `--dry-run` | show what would change, write nothing |
| `--force` | regenerate even when code clips were edited in the Studio (the code wins; the previous file goes to `.caju/history/`) |

See [Video by code](../guide/video-by-code) and [merging](../guide/studio#conflicts).

### `caju check`

```bash
caju check [ids...] [--dir projects] [--components <dir>]
```

Validates every project (or the given ids): the [schema rules](./project-json#validation-rules), assets on disk, components that exist and compile, and the determinism lint on `components/`. Exits non-zero on errors.

### `caju render`

```bash
caju render <id> [--out file] [--format mp4-h264] [--resolution 1080] [--fps 30] [--quality high]
                 [--no-audio] [--concurrency 2] [--serve-url <url>] [--components <dir>] [--dir projects]
```

| Flag | Values | Default |
|---|---|---|
| `--out`, `-o` | output path | `<project>/renders/<id>-<timestamp>.<ext>` |
| `--format` | `mp4-h264`, `mp4-h265`, `mov-prores`, `webm-vp9`, `gif`, `png-seq` | `mp4-h264` |
| `--resolution` | shorter side: `720`, `1080`, `1440`, `2160` | native (largest ≤ project) |
| `--fps` | integer 1–120 | project fps |
| `--quality` | `draft`, `good`, `high`, `max` | `high` |
| `--no-audio` | — | audio on |
| `--concurrency` | browser pages in parallel, `1`–`2` | 2 |
| `--serve-url` | URL of a running Studio to reuse | internal server |

### `caju still`

```bash
caju still <id> --frame <n> [--out frame.png] [--resolution 1080] [--serve-url <url>] [--dir projects]
```

### `caju doctor` {#doctor}

```bash
caju doctor [--dir projects] [--components <dir>]
```

Diagnoses your environment and prints a hint for each problem: Node.js, npm, FFmpeg and a Chromium browser for rendering, the Studio build, the projects and components folders, write permission, free disk space and memory. Exits non-zero when a check fails (warnings don't). Run it first when something doesn't start.

### `caju skills add`

```bash
caju skills add [--target <folder>] [--agents claude|all]
```

| Flag | Default | Meaning |
|---|---|---|
| `--target` | `.` | project folder; skills go to `<target>/.claude/skills/` |
| `--agents` | `claude` | `all` also keeps a marked block in `<target>/AGENTS.md`, read by other agents (Codex, Cursor, Gemini…) |

See [Using AI agents](../guide/ai-agents).

## `create-caju`

```bash
npm create caju@latest [folder] [-- options]
```

| Flag | Meaning |
|---|---|
| `-t`, `--template <name>` | `blank` (default), `reel-legendado`, `explainer-16x9`, `data-video`, `audiograma` |
| `-y`, `--yes` | no prompts: folder `meu-video`, template `blank`, installs dependencies and skills |
| `--no-install` | skip installing dependencies |
| `--skills` / `--no-skills` | install (or skip) the agent skills |
| `--pm <name>` | `npm`, `pnpm`, `yarn` or `bun` (default: the one that ran `create`) |

## Environment variables

| Variable | Effect |
|---|---|
| `CAJU_BROWSER_PATH` | Chromium/Chrome/Edge executable used for rendering |
| `CAJU_FFMPEG_PATH` | FFmpeg executable used for rendering (default: bundled) |
| `FFPROBE_PATH` | ffprobe used by `measureMedia()` (default: on `PATH`) |
