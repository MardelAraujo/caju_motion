---
title: Caju vs. Remotion
description: Comparação factual entre o Caju Motion e o Remotion - licença, modelo de autoria, timeline visual, render e suporte a IA.
---

# Caju vs. Remotion

O [Remotion](https://www.remotion.dev) popularizou o "vídeo como código React", e o Caju Motion aproveita várias ideias públicas dele (`useFrame` ≈ `useCurrentFrame`, `Sequence`, `interpolate`, `spring`, `delayRender`). O Caju é uma implementação **clean-room**: nenhum código do Remotion é usado ou derivado.

Os dois projetos fazem apostas diferentes. Esta página resume o cenário em outubro de 2026 (Remotion v4.0.x); confira a documentação do Remotion para o estado atual dele.

| | Remotion | Caju Motion |
|---|---|---|
| Licença | Código disponível; grátis para indivíduos e equipes pequenas (até 3 pessoas), licença paga para empresas acima disso | **MIT** para framework, Studio e renderer. Só um futuro serviço de nuvem, opcional, é comercial |
| Fonte da verdade | Código React (`<Composition>`) | Um documento JSON, o `project.json`, gerado por código **e** editado visualmente |
| Autoria | React primeiro; o Studio edita props declaradas com zod | Híbrida: `video.ts` (`defineProject`) para a estrutura, Caju Studio para tempo e acabamento, componentes React (`defineComponent`) onde keyframes não bastam |
| Edição em timeline visual | Oferecida como produtos pagos à parte (Timeline / Editor Starter) | Embutida e gratuita: timeline multi-trilha, mover/cortar/dividir, textos, cores, áudio, props de componentes |
| Ida e volta código ↔ visual | — | `caju build` regenera os clipes de código e **preserva as edições do Studio**; conflitos são reportados, nunca sobrescritos em silêncio |
| Runtime de animação | `useCurrentFrame`, `Sequence`, `interpolate`, `spring`, … | `useFrame`, `Sequence`, `Fill`, `interpolate`, `spring` (analítico), `Easing`, `random(seed)`, `delayRender` |
| Render local | Maduro: `renderMedia` / `renderStill`, muitos codecs | `caju render` / `caju still`: H.264, H.265, ProRes 422, VP9, GIF, sequência PNG |
| Render em nuvem / distribuído | Lambda, Cloud Run | Ainda não (planejado, F4) |
| Player no navegador | `@remotion/player` | Ainda não (`@caju-motion/player`, F4) |
| Templates / scaffolding | `create-video` com muitos templates | `create-caju` com 5 templates (v0.2) |
| Suporte a IA | Skills de agente, `llms.txt` | Skills de agente (`caju skills add`), `llms.txt` |
| Maturidade | Anos em produção, ecossistema grande | Jovem (v0.2) |

## Quando escolher cada um

- **Escolha o Remotion** se quer um fluxo maduro, só React, com render em nuvem hoje, e a licença serve para a sua equipe.
- **Escolha o Caju** se quer que designers ou editores ajustem o que desenvolvedores (ou agentes) geram — numa timeline de verdade, sem perder o trabalho de nenhum dos lados — sob licença MIT.

Os dois são baseados em frames e determinísticos, então as ideias passam de um para o outro com facilidade.
