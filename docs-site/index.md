---
layout: home
title: Caju Motion
description: Open-source video framework. Video by code and by a visual timeline editor, on the same project.json, rendered locally to MP4.
hero:
  name: Caju Motion
  text: Code it. Then move it.
  tagline: Motion graphics by code and by a visual timeline, on the same source of truth. Open source (MIT), rendered on your machine.
  image:
    src: /logo-512.png
    alt: Caju Motion
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Why Caju?
      link: /guide/comparison
    - theme: alt
      text: GitHub
      link: https://github.com/MardelAraujo/caju_motion
features:
  - title: Timeline + code, one file
    details: "video.ts generates project.json; Caju Studio edits the same file on a multi-track timeline. caju build regenerates code clips and keeps every Studio edit."
    link: /guide/concepts
    linkText: Concepts
  - title: MIT, open core
    details: The framework, the Studio and the renderer are MIT. No per-seat license, no per-render fee. Only an optional future cloud service is commercial.
    link: /license
    linkText: License
  - title: Local render
    details: "caju render turns a project into MP4, MOV ProRes, WebM, GIF or PNG frames with headless Chrome and FFmpeg, frame-exact, audio mixed from the document."
    link: /guide/rendering
    linkText: Rendering
  - title: React components, hot reload
    details: "defineComponent + a zod schema: your component shows up in the Studio's Componentes tab, its props become inspector controls, and it reloads on save."
    link: /guide/components
    linkText: Components
  - title: Built for coding agents
    details: Agent Skills teach Claude Code and compatible agents to structure assets and audio, write valid projects and render them. Plus llms.txt for any LLM.
    link: /guide/ai-agents
    linkText: AI agents
  - title: Deterministic by design
    details: "Rendering is a pure function of (project, frame), in integer frames. Preview and export run the same code, and a lint keeps randomness and clocks out."
    link: /reference/core
    linkText: Core API
---

## Thirty seconds of Caju

```ts
// projects/promo/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'promo', name: 'Promo', format: 'reel-9x16', background: '#171512', duration: 150 },
  (p) => {
    const { width } = p.settings;
    p.scene('abertura', 'Opening', 0, 150, (s) => {
      s.text('Code it.\nThen move it.', { size: 110, weight: 800, color: '#FFF8E9' },
             { id: 'title', x: width / 2, y: 960, enter: { at: 0, dur: 18, rise: 40 } });
      s.component('CountUp', { from: 0, to: 87, suffix: '%' }, { id: 'counter', y: 1300, at: [30, 150] });
    });
  },
);
```

```bash
npx caju build promo     # video.ts → project.json (keeps Studio edits)
npx caju studio          # tweak it on the timeline
npx caju render promo    # → projects/promo/renders/promo-<timestamp>.mp4
```
