---
title: Roadmap
description: Caju Motion roadmap by phase - public foundation, local render, video by code, distribution, and the ecosystem (player, media, cloud).
---

# Roadmap

Caju Motion ships in phases. Each phase has a "done when" test, and the [agent skills](./guide/ai-agents) are updated at the end of every phase so agents only use what exists.

| Phase | Delivers | Done when | Status |
|---|---|---|---|
| **F0 Public foundation** | MIT license; `@caju-motion/*` packages; build (ESM + `.d.ts`), prebuilt Studio, changesets in lockstep, release with provenance | each package installs from `npm pack` into an empty folder and `npx caju studio` starts without `tsx` | done |
| **F1 Local render** | `@caju-motion/renderer-node`, `@caju-motion/audio`, `caju render` / `still`, Studio Export button, golden + A/V tests in CI (Windows + Linux) | fixtures render to MP4 identical to the preview; A/V ≤ 1 frame | done |
| **F2 Code** | `@caju-motion/sdk` (`defineProject`), `defineComponent`, component clips, Componentes tab with hot reload, `caju build` merging by `origin` | a code-only template + a component opens in the Studio, is edited, rebuilds without losing edits, and renders | done |
| **F3 Distribution** | `create-caju` + templates, `caju doctor`, `caju skills add`, skill evals, docs in English and Portuguese with `llms.txt`, npm release | a new developer goes from zero to MP4 in under 5 minutes; an agent with the skills makes a valid video from a prompt | in progress |
| **F4 Ecosystem** | [`@caju-motion/player`](./reference/player) (embeddable `<Player>`) ✓, [`@caju-motion/media`](./reference/media) (proxies, frame-exact WebCodecs decode) ✓, [captions/TTS](./guide/voice-captions) ✓, [motion presets](./guide/animation#motion-presets) (transitions, animations, effects, overlays, adjustment layers) ✓, [audio mix](./guide/audio#ducking) (ducking, loudness, volume keyframes, pan) ✓, agent review tools (`caju snapshot`, `capture`, `beats`, `catalog`, `--json`) ✓; later: `@caju-motion/cloud` (commercial), template marketplace | — | in progress |

## Also planned

- Keyframe editing on the Studio timeline.
- Font assets (custom fonts in renders).
- Masks and custom transition shaders.
- Editing transitions, animations and effects in the Studio inspector.

Follow progress and discuss priorities on [GitHub](https://github.com/MardelAraujo/caju_motion/issues).
