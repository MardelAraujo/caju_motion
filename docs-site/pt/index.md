---
layout: home
title: Caju Motion
description: Framework de vídeo open source. Vídeo por código e por editor de timeline visual, no mesmo project.json, com render local em MP4.
hero:
  name: Caju Motion
  text: Code it. Then move it.
  tagline: Motion graphics por código e por timeline visual, na mesma fonte da verdade. Open source (MIT), renderizado na sua máquina.
  image:
    src: /logo-512.png
    alt: Caju Motion
  actions:
    - theme: brand
      text: Começar
      link: /pt/guide/getting-started
    - theme: alt
      text: Por que o Caju?
      link: /pt/guide/comparison
    - theme: alt
      text: GitHub
      link: https://github.com/MardelAraujo/caju_motion
features:
  - title: Timeline + código, um arquivo
    details: "O video.ts gera o project.json; o Caju Studio edita o mesmo arquivo numa timeline multi-trilha. O caju build regenera os clipes de código e preserva toda edição feita no Studio."
    link: /pt/guide/concepts
    linkText: Conceitos
  - title: MIT, open core
    details: Framework, Studio e renderer são MIT. Sem licença por pessoa, sem cobrança por render. Só um futuro serviço de nuvem, opcional, é comercial.
    link: /pt/license
    linkText: Licença
  - title: Render local
    details: "O caju render transforma o projeto em MP4, MOV ProRes, WebM, GIF ou quadros PNG com Chrome headless e FFmpeg, quadro a quadro, com o áudio mixado a partir do documento."
    link: /pt/guide/rendering
    linkText: Render
  - title: Componentes React com hot reload
    details: "defineComponent + um schema zod: o componente aparece na aba Componentes do Studio, as props viram controles no inspetor e ele recarrega ao salvar."
    link: /pt/guide/components
    linkText: Componentes
  - title: Feito para agentes de código
    details: Agent Skills ensinam o Claude Code e agentes compatíveis a organizar assets e áudio, escrever projetos válidos e renderizá-los. E llms.txt para qualquer LLM.
    link: /pt/guide/ai-agents
    linkText: Agentes de IA
  - title: Determinístico por design
    details: "O render é função pura de (projeto, frame), em frames inteiros. Preview e exportação rodam o mesmo código, e uma lint mantém aleatoriedade e relógio de fora."
    link: /pt/reference/core
    linkText: API do core
---

## Caju em trinta segundos

```ts
// projects/promo/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'promo', name: 'Promo', format: 'reel-9x16', background: '#171512', duration: 150 },
  (p) => {
    const { width } = p.settings;
    p.scene('abertura', 'Abertura', 0, 150, (s) => {
      s.text('Code it.\nThen move it.', { size: 110, weight: 800, color: '#FFF8E9' },
             { id: 'titulo', x: width / 2, y: 960, enter: { at: 0, dur: 18, rise: 40 } });
      s.component('CountUp', { from: 0, to: 87, suffix: '%' }, { id: 'contador', y: 1300, at: [30, 150] });
    });
  },
);
```

```bash
npx caju build promo     # video.ts → project.json (preserva as edições do Studio)
npx caju studio          # ajuste na timeline
npx caju render promo    # → projects/promo/renders/promo-<timestamp>.mp4
```
