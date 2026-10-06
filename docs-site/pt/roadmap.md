---
title: Roadmap
description: Roadmap do Caju Motion por fase - fundação pública, render local, vídeo por código, distribuição e ecossistema (player, mídia, nuvem).
---

# Roadmap

O Caju Motion avança em fases. Cada fase tem um critério de "pronto quando", e as [skills de agente](./guide/ai-agents) são atualizadas ao fim de cada fase, para os agentes só usarem o que existe.

| Fase | Entrega | Pronto quando | Status |
|---|---|---|---|
| **F0 Fundação pública** | Licença MIT; pacotes `@caju-motion/*`; build (ESM + `.d.ts`), Studio pré-compilado, changesets em lockstep, release com provenance | cada pacote instala via `npm pack` numa pasta vazia e `npx caju studio` sobe sem `tsx` | feita |
| **F1 Render local** | `@caju-motion/renderer-node`, `@caju-motion/audio`, `caju render` / `still`, botão Exportar do Studio, testes golden + A/V no CI (Windows + Linux) | fixtures viram MP4 iguais à preview; A/V ≤ 1 frame | feita |
| **F2 Código** | `@caju-motion/sdk` (`defineProject`), `defineComponent`, clipes de componente, aba Componentes com hot reload, `caju build` mesclando por `origin` | um template só em código + um componente abre no Studio, é editado, regenera sem perder edições e renderiza | feita |
| **F3 Distribuição** | `create-caju` + templates, `caju doctor`, `caju skills add`, evals das skills, docs em inglês e português com `llms.txt`, publicação no npm | dev novo vai do zero ao MP4 em menos de 5 minutos; agente com as skills gera vídeo válido a partir de um prompt | em andamento |
| **F4 Ecossistema** | `@caju-motion/player` (`<Player>` embutível), `@caju-motion/media` (proxies, decode frame-exato com WebCodecs), legendas/TTS, `@caju-motion/cloud` (comercial), marketplace de templates | — | planejada |

## Também planejado

- Edição de keyframes na timeline do Studio.
- Assets de fonte (fontes próprias no render).
- Renderizar `transitionIn/Out`, `animationIn/Out/Loop` e efeitos, que o schema já guarda.
- Keyframes de volume e `pan` na mixagem de áudio.

Acompanhe e discuta prioridades no [GitHub](https://github.com/MardelAraujo/caju_motion/issues).
