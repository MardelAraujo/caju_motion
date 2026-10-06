---
title: Using AI agents
description: Let Claude Code and other coding agents create Caju videos - install the Caju Agent Skills with caju skills add, what each skill covers, and llms.txt for any LLM.
---

# Using AI agents

Caju Motion is designed so a coding agent can go from a brief to a rendered video: the document is plain JSON with a strict schema, `caju check` gives precise errors, and the [merge rules](./studio#conflicts) keep human Studio edits safe from regeneration.

## Install the skills

Caju ships **Agent Skills** (a folder per skill with a `SKILL.md` and rule files loaded on demand) for Claude Code and compatible agents.

```bash
npx caju skills add                      # into ./.claude/skills/
npx caju skills add --target <folder>    # into another project
npx caju skills add --agents all         # also point other agents at them via AGENTS.md
```

| Flag | Effect |
|---|---|
| `--target <folder>` | project to install into (default: the current folder); skills go to `<folder>/.claude/skills/` |
| `--agents claude` | Claude Code only (default) |
| `--agents all` | also keeps a marked block in `AGENTS.md` listing the skills, for agents that read it (Codex, Cursor, Gemini…) |

`npm create caju@latest` offers to install them too (`--skills`). From a repo checkout: `npm run skills:install`.

::: info Coming with the first release
`npx caju …` works once the packages are on npm. Until then, use `npm run caju -- skills add` inside a checkout.
:::

## What the skills cover

| Skill | Role |
|---|---|
| `caju-best-practices` | Router + golden rules + end-to-end workflow. The agent loads it first |
| `caju-setup` | Install, environment, diagnosing Node/FFmpeg/port/browser problems |
| `caju-assets` | Folder structure, formats, sizes, registering assets |
| `caju-audio` | Audio tracks, loudness, fades, ducking, timing to narration |
| `caju-authoring` | `project.json` and `video.ts` (`defineProject`), keyframes, layout, safe areas |
| `caju-components` | Deterministic React components with `@caju-motion/core` |
| `caju-studio` | Coexisting with humans in the Studio without losing their edits |
| `caju-render` | Export settings and verifying the output |

The skills are in English (agents do better that way) and each has an **Availability** table separating what exists today from what is planned, so the agent never runs a command that doesn't exist yet. Every project JSON in the skills is validated against the schema in CI.

## Golden rules the agent follows

1. **The document is the truth.** Validate with `caju check` after every change.
2. **Time is integer frames** at `settings.fps`.
3. **Deterministic only:** no `Math.random`, `Date`, timers or CSS transitions in render code.
4. **Never destroy Studio edits:** check `meta.updatedAt` vs `meta.createdAt`; use `caju build`, which merges.
5. **Assets live inside the project folder,** referenced by relative `src`.
6. **Check, don't guess:** fix every validator error before calling the work done.

## Example prompts

- "Create a 20-second 9:16 reel announcing our launch. Use `assets/images/logo.svg` and the voice-over in `assets/audio/vo/`. Time the scenes to the narration."
- "Add an animated bar chart component for this JSON data and use it in scene 3."
- "I moved the title in the Studio. Regenerate the video from `video.ts` without losing my changes."
- "Render it for Instagram feed and check the loudness."

## llms.txt

For any LLM (no skills needed), this site publishes:

| File | Content |
|---|---|
| [`llms.txt`](https://mardelaraujo.github.io/caju_motion/llms.txt) | index of every page with a one-line description |
| [`llms-full.txt`](https://mardelaraujo.github.io/caju_motion/llms-full.txt) | all English docs plus the full skills, as one Markdown file |

Paste `llms-full.txt` into a chat, or point your tool at it, to give a model the whole framework in one go.
