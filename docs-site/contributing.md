---
title: Contributing
description: How to contribute to Caju Motion - monorepo layout, the source export condition, running the Studio and tests, determinism lint, changesets and docs.
---

# Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/MardelAraujo/caju_motion).

## Setup

```bash
git clone https://github.com/MardelAraujo/caju_motion.git
cd caju_motion
npm install
npm run check      # typecheck + determinism lint + tests + fixtures: must be green
npm run studio     # Studio in dev mode (Vite/HMR) at http://localhost:3700
```

Node ≥ 20.11 (CI uses 22). CI runs on Windows and Linux.

## Monorepo

```text
packages/   schema · core · renderer · player · sdk · audio · media · voice · renderer-node · server · studio · cli · skills · caju · create-caju
fixtures/   minimal valid projects (CI validates and renders them)
projects/   local example projects
components/ example components (CountUp, LowerThird)
scripts/    determinism lint, fixture media, legacy builder, llms.txt generator
docs-site/  this website (VitePress)
```

| Package | Role |
|---|---|
| `@caju-motion/schema` | `project.json` (zod), formats + safe areas, export settings, migrations |
| `@caju-motion/core` | animation runtime |
| `@caju-motion/renderer` | `ProjectRenderer` (document + frame → React DOM), `defineComponent` |
| `@caju-motion/player` | `<Player>` for React apps |
| `@caju-motion/sdk` | `defineProject`, `caju build` merge |
| `@caju-motion/audio` | audio mix (FFmpeg filtergraph) |
| `@caju-motion/media` | probe, thumbnails, waveforms, proxies, WebCodecs frame decoder |
| `@caju-motion/voice` | TTS providers, word timings, captions |
| `@caju-motion/renderer-node` | headless Chromium → FFmpeg render |
| `@caju-motion/server` | local project store, assets API, render API, production Studio server |
| `@caju-motion/studio` | the editor, shipped prebuilt |
| `@caju-motion/cli` | the `caju` command |
| `@caju-motion/skills` | Agent Skills |
| `caju`, `create-caju` | short CLI name, scaffolder |

## The `source` condition

Packages export their TypeScript source under the `source` export condition, and `dist/` for npm. The monorepo, tests and `npm run caju` use `source` (`tsx --conditions=source`), so you don't need to build packages to work on them. `npm run build` builds `dist/` with tsup.

## Scripts

| Script | Does |
|---|---|
| `npm run caju -- <command>` | the CLI from source |
| `npm run studio` | Studio dev mode |
| `npm run typecheck` | `tsc` |
| `npm run lint` | determinism lint (`scripts/lint-determinism.ts`) |
| `npm test` | vitest (`packages/*/src/**/*.test.ts(x)`) |
| `npm run check:fixtures` | `caju check` on `fixtures/projects` |
| `npm run check` | all of the above |
| `npm run build` | builds every package |

Render integration tests need Chrome and FFmpeg and are opt-in: `CAJU_RENDER_IT=1 npx vitest run packages/renderer-node packages/player packages/media --maxWorkers=1`.

## Rules

- **Determinism:** no `Math.random`, `Date`, timers, CSS animations or `Intl` in render code. Use `@caju-motion/core`.
- **Integer frames** everywhere in the document.
- **Clean room:** never copy or derive code from Remotion.
- When you change a command or capability, update the matching skill's **Availability** table in `packages/skills/skills/*/SKILL.md`; JSON examples in the skills are validated by the tests.

## Changesets and releases

Every user-visible change gets a changeset:

```bash
npm run changeset
```

All `@caju-motion/*` packages, `caju` and `create-caju` are versioned **in lockstep**. Releases are manual (GitHub Actions → **release**): with pending changesets it opens a "Version Packages" PR; running it again after the merge publishes to npm with provenance.

## Docs

The site lives in `docs-site/` (English at the root, Portuguese in `docs-site/pt/`). Keep both languages in sync, give every page a `title` and `description` in its frontmatter, then:

```bash
npx tsx scripts/llms.ts            # regenerates docs-site/public/llms.txt and llms-full.txt, validates pages
npx vitepress dev docs-site        # local preview
npx vitepress build docs-site      # fails on dead links
```
