---
title: Project structure
description: The folders Caju Motion expects - projects, assets per kind, components, renders and the .caju cache - and naming conventions.
---

# Project structure

By default the `caju` CLI works on a `projects/` folder and looks for components in the `components/` folder next to it.

```text
my-video/
  projects/
    promo/
      video.ts              defineProject() — code source (optional)
      project.json          the source of truth (built from code and/or edited in the Studio)
      assets/
        images/             png, jpg, webp, svg
        video/              mp4 (H.264, constant frame rate)
        audio/
          vo/               voice-over, one file per sentence or scene
          music/            soundtrack
          sfx/              sound effects
          amb/              ambience / room tone
        fonts/              woff2 (reserved, not rendered yet)
        data/               json/csv read by video.ts (not by the renderer)
      renders/              caju render output (git-ignored)
      .caju/
        history/            previous versions, written on every Studio save and caju build
        last-build.json     baseline for detecting Studio edits — keep it in git
  components/               defineComponent() — shows up in the Studio's Componentes tab
```

| Flag | Changes |
|---|---|
| `--dir <folder>` | the projects folder (default `projects`) |
| `--components <folder>` | the components folder (default `<dir>/../components`) |

## Conventions

- **One folder per project.** The folder name is the project `id`; with `video.ts` it must equal the `id` passed to `defineProject`.
- **Assets live inside the project folder** and are referenced by a relative `src` with forward slashes: `assets/images/logo.png`. No absolute paths, no URLs: renders work offline and are reproducible.
- **File names:** lowercase kebab-case ASCII, no spaces (`logo-acme.svg`, `vo-03-pricing.wav`). Linux renders are case-sensitive.
- **Ids are global** inside a document: assets, tracks, clips and markers share one namespace. Asset `vo-01`, clip `vo-01-clip`.
- Files uploaded through the Studio land in `assets/` with a sanitized name. That's fine.

## What to commit

| Path | Commit? |
|---|---|
| `video.ts`, `project.json`, `assets/`, `components/` | yes |
| `.caju/last-build.json` | **yes** — without it, Studio edits to code clips can't be detected on a fresh clone |
| `.caju/*` (history, cache), `renders/` | no |

Older projects may have `.frame/` instead of `.caju/`; it is read as a fallback.
