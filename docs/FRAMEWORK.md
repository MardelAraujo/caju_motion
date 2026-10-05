# Caju Motion — plano do framework público

> **Code it. Then move it.** Vídeo por código **e** por timeline visual, na mesma fonte da verdade.
>
> Este documento substitui o rumo "ferramenta interna" do [`PLANO.md`](./PLANO.md) pelo rumo **framework público**.
> O PLANO continua valendo para os detalhes técnicos do editor; onde os dois divergem, vale este.

## 1. Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Licença | **Open-core**: núcleo MIT; monetização em render em nuvem, templates/temas premium e Studio colaborativo/hospedado | A licença paga do Remotion (grátis só até 3 pessoas; US$ 25/dev/mês + cobrança por render) é a maior objeção a ele. Abrir o núcleo é o atalho de adoção |
| Autoria | **Híbrida**: `project.json` é a verdade; SDK TS (`defineProject`) gera o JSON; `defineComponent` traz React próprio | Diferencial real: código e timeline editável na mesma fonte. No Remotion, timeline é produto pago e o Studio só ajusta props |
| Nomes | Escopo npm **`@caju-motion/*`**, CLI `caju` (alias `caju-motion`), scaffolder `npm create caju-motion` | O escopo `@caju` já pertence a uma org no npm (verificado em 05/10/2026); `@caju-motion` estava livre. Os nomes sem escopo `caju` e `create-caju-motion` também estavam livres; vale reservá-los |
| Engenharia | **Clean-room** em relação ao Remotion | A licença do Remotion proíbe derivar o código. Usamos ideias e APIs públicas como referência, nunca código |

## 2. Onde estamos vs. Remotion

| | Remotion (v4.0.532, out/2026) | Caju hoje |
|---|---|---|
| Runtime de animação | `useCurrentFrame`, `Sequence`, `interpolate`, `spring`, `delayRender` | **Já existe** em `@caju-motion/core`: `useFrame`, `useVideoConfig`, `Sequence`, `Fill`, `interpolate`, `spring` (analítico), `Easing`, `random(seed)`, `delayRender` (ainda não ligado ao render) |
| Autoria | React-first (`<Composition>`), props via zod no Studio | Documento JSON + editor com timeline multi-trilha; SDK ainda é `scripts/examples/builder.ts` |
| Timeline visual | Produto pago (Timeline / Editor Starter) | **Já temos** — diferencial |
| Render | bundle → Chrome Headless Shell → screenshots → FFmpeg; `renderMedia`/`renderStill`; Lambda/Cloud Run; WebCodecs no browser | **Falta**. Base pronta: `?render=<id>&frame=<n>` (`RenderView.tsx`) e o modelo de configurações (`exportSettings.ts`) |
| Distribuição | `dist` ESM+CJS, versões em lockstep, `create-video` + ~20 templates | **F0 feita:** `dist` ESM + `.d.ts` (tsup), Studio pré-buildado, condição `source` para o dev, changesets em lockstep, release manual com provenance. Ainda não publicado |
| IA | 12 skills (`SKILL.md` + regras `.md`, skill-roteador), `npx skills add`, `llms.txt` | **Esta entrega**: `packages/skills` |

## 3. Arquitetura alvo

| Pacote | Origem | Responsabilidade | Licença |
|---|---|---|---|
| `@caju-motion/schema` | `packages/schema` | Formato `project.json` (zod), formatos + safe areas, migrações | MIT |
| `@caju-motion/core` | `packages/core` | Runtime de animação. Novo: `asset()`, `<Img>`, `<Audio>`, `<Video>` que registram `delayRender` | MIT |
| `@caju-motion/renderer` | `packages/renderer` | `ProjectRenderer` (doc + frame → DOM). Novo: registro de componentes (clip `component`) | MIT |
| `@caju-motion/sdk` | novo (de `scripts/examples/builder.ts`) | `defineProject` (cenas, elementos, enter/exit, keyframes, trilhas automáticas, timeline elástica por voz) e `defineComponent({ name, schema, render })` | MIT |
| `@caju-motion/media` | novo | ffprobe, hash, thumbnails, waveform, proxies, decode frame-exato (WebCodecs) | MIT |
| `@caju-motion/audio` | novo | Mix por filtergraph (adelay/atrim/volume/afade/pan/amix), loudnorm, ducking; mix de preview via Web Audio | MIT |
| `@caju-motion/renderer-node` | novo (era `export`) | `renderMedia`/`renderStill`: Chromium headless → screenshots → FFmpeg; chunks paralelos + concat; mux de áudio com offset explícito | MIT |
| `@caju-motion/server` | `packages/server` | API Hono + store. Novo: `POST /render`, progresso via SSE/WebSocket, watcher | MIT |
| `@caju-motion/studio` | `packages/editor` | Editor, publicado já buildado (`dist/`) e servido estático pelo CLI | MIT |
| `@caju-motion/cli` (`caju`) | `packages/cli` | `studio`, `render`, `still`, `new`, `check`, `build`, `doctor`, `skills add`, `browser ensure`, `upgrade` | MIT |
| `create-caju-motion` | novo | Scaffolder + templates (blank, reel legendado, explainer 16:9, audiograma, data-video) e oferta de instalar as skills | MIT |
| `@caju-motion/skills` | `packages/skills` (**criado agora**) | Skills de agente | MIT |
| `@caju-motion/player` | futuro | `<Player>` embutível em apps React | MIT |
| `@caju-motion/cloud` | futuro | Render distribuído, fila, storage, templates premium, Studio colaborativo | **Comercial** |

Princípios que não mudam:
- O renderer é função pura `(documento, frame) → pixels`. Preview e export usam o mesmo código.
- Tempo é sempre em **frames inteiros**.
- O lint de determinismo (`scripts/lint-determinism.ts`) passa a valer também para componentes de usuário, via `caju check`.

## 4. Projeto do usuário (gerado por `create-caju-motion`)

```
meu-video/
  caju.config.ts            formato padrão, fps, pasta de vídeos, concorrência de render
  package.json              "dev": "caju studio", "render": "caju render"
  videos/
    lancamento/
      video.ts              defineProject() — fonte em código (opcional)
      project.json          fonte da verdade (gerada pelo código e/ou editada no Studio)
      assets/
        images/  video/  fonts/  data/
        audio/vo/  audio/music/  audio/sfx/  audio/amb/
  components/               defineComponent() — aparece na aba "Componentes" do Studio
  public/                   assets compartilhados (marca, fontes) → asset('/brand/logo.svg')
  .caju/                    cache, histórico, proxies (gitignored)
  out/                      renders
```

- **Compatibilidade:** `projects/<id>/project.json + assets/` (layout atual) continua aceito; `.frame/` é lido como fallback de `.caju/`.
- **Round-trip código ↔ Studio:**
  - Clipes do `video.ts` levam `origin: 'code'`; os criados no Studio levam `origin: 'editor'`.
  - `caju build` regenera só os de código, preserva os do editor e mostra um diff se um clipe de código foi editado à mão.
  - Isso evolui o `guardOverwrite()` atual.

## 5. Pipeline de render (Fase 1)

1. `RenderView` (`?render=`) passa a usar o gate de `@caju-motion/core`, exposto em `window.__caju`. Fontes, imagens e vídeo abrem/fecham handles.
2. `@caju-motion/renderer-node` abre N abas headless (concorrência por faixa de frames). Para cada frame: `setFrame(n)` → espera o gate → screenshot (JPEG sem alpha; PNG para ProRes 4444/GIF/sequência) → pipe para o FFmpeg.
3. Áudio mixado à parte a partir do documento (`audio.volume/fadeIn/fadeOut/pan`, `trimIn`, `speed`). O mux é feito com offset explícito, porque o pipeline antigo (`video_AC`) tinha atraso de AAC de ~42,7 ms.
4. Codecs e qualidade vêm de `exportSettings.ts` (H.264/H.265/ProRes/VP9/GIF/PNG, CRF por qualidade), que vira módulo compartilhado. O balão Exportar do Studio chama `POST /api/projects/:id/render` e mostra o progresso.
5. Testes:
   - golden renders dos `fixtures/` (pixelmatch);
   - preview × MP4;
   - sincronia A/V com `fixtures/projects/landscape-audio` (flash + beep no frame 30, tolerância ≤ 1 frame).

## 6. Skills de agente (`packages/skills`)

Formato Agent Skills / Claude Code: uma pasta por skill, com `SKILL.md` (frontmatter `name`, `description`, `version`) e arquivos de regra `.md` carregados sob demanda.

O conteúdo é em inglês, porque os agentes rendem melhor assim. Cada skill tem uma seção **Availability** que separa o que existe hoje do que vem nas próximas fases, para nenhum agente rodar um comando que ainda não existe.

| Skill | Papel |
|---|---|
| `caju-best-practices` | Roteador + regras de ouro + fluxo ponta a ponta |
| `caju-setup` | Instalação, ambiente, diagnóstico |
| `caju-assets` | Estrutura de pastas, formatos, registro de assets |
| `caju-audio` | Trilhas de áudio, loudness, mixagem, timing por locução |
| `caju-authoring` | `project.json` e geração por código |
| `caju-components` | Código React determinístico com `@caju-motion/core` |
| `caju-studio` | Convivência código ↔ Studio sem perder edições |
| `caju-render` | Exportação e verificação do resultado |

Distribuição:
- **Hoje:** `npm run skills:install` (copia para `.claude/skills/`).
- **F3:** `caju skills add`, pergunta no `create-caju-motion`, repo espelho para `npx skills add`, plugin do Claude Code, `llms.txt` no site de docs.

Qualidade:
- Todo JSON de projeto marcado nas skills é validado pelo schema em `npm run check`.
- Na F3 entra `skills-evals`: prompt → agente gera projeto → `caju check` → render.

## 7. Roadmap

| Fase | Entrega | Pronto quando |
|---|---|---|
| **F0 Fundação pública** ✅ | Primeiro commit; LICENSE MIT; renomear `@frame` → `@caju-motion` (pacotes, headers `x-frame-*`, `.frame/`); remover o acoplamento AutoMind (`BRAND_COLORS`/preset "AutoChecker" em `commands.ts`, fonte padrão em `renderer/props.ts`); mover `projects/` e scripts AutoMind para repo privado; checar a licença da fonte Hando; build tsup (ESM + `.d.ts`), Studio buildado, changesets em lockstep, release com provenance | `npm pack` de cada pacote instala num diretório vazio e `npx caju studio` sobe sem `tsx` |
| **F1 Render local** | `@caju-motion/renderer-node`, `@caju-motion/audio`, `caju render`/`still`, Exportar do Studio ligado, golden + A/V no CI (Windows + Linux) | Fixtures e `exemplo` viram MP4 iguais à preview; A/V ≤ 1 frame |
| **F2 Código** | `@caju-motion/sdk` (`defineProject`, `defineComponent`), clip `component` renderizando, aba Componentes com HMR, `caju build` com merge por `origin` | Template feito só em código + 1 componente abre no Studio, é editado, regenera sem perder edições e renderiza |
| **F3 Distribuição** | `create-caju-motion` + templates, `caju doctor`, `caju skills add`, evals, docs EN + pt-BR com `llms.txt`, publicação no npm | Dev novo vai de zero a MP4 em < 5 min; agente com as skills gera vídeo válido a partir de um prompt |
| **F4 Ecossistema** | `@caju-motion/player`, `@caju-motion/media` (proxies/WebCodecs), legendas/TTS, `@caju-motion/cloud` (pago), marketplace de templates | — |

Ao concluir cada fase, atualize a tabela **Availability** de cada `SKILL.md` e a versão das skills.
