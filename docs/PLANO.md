# Plano — Editor de vídeo próprio (estilo CapCut) + framework de vídeo por código

> **Atualização (out/2026):** o projeto virou o framework público **Caju Motion**. O rumo, a licença (open-core), os nomes (`@caju-motion/*`, CLI `caju`) e o roadmap F0–F4 estão em [`FRAMEWORK.md`](./FRAMEWORK.md), que prevalece onde divergir deste documento. Diferenças principais:
> - continuamos com **npm workspaces** (não pnpm + Turborepo);
> - o pacote `export` passa a se chamar `@caju-motion/renderer-node`;
> - `brand-automind` sai do núcleo e vai para um repositório privado;
> - o público deixa de ser só a AutoMind.
>
> As seções técnicas abaixo (editor, formato, export, riscos) continuam válidas.

## Contexto

Hoje os vídeos da AutoMind são feitos em Remotion (`video_AC`). Cada cena é código React com as constantes fixas no próprio código, então só quem programa consegue editar. O objetivo é criar uma **ferramenta própria, sem Remotion**, para compartilhar com os colegas. Ela terá:

- um **editor visual no nível do CapCut**: timeline multitrilha, cortar, mover, editar texto, keyframes, áudio, transições e banco de mídia;
- um **framework de código**, para que devs e IA continuem gerando vídeos automaticamente, e esses vídeos abram no editor para ajustes.

Decisões já tomadas:

| Tema | Decisão |
|---|---|
| Onde roda | Localmente na máquina de cada pessoa. `npx <tool> studio` abre o editor no navegador (como o Remotion Studio). |
| Como os vídeos nascem | Código **e** editor, sobre o mesmo formato de projeto |
| Colaboração | Um editor por vez, com histórico de versões. Tempo real fica fora do escopo inicial. |
| Vídeos atuais | Não serão migrados. É um projeto novo e independente. |

Nome provisório usado no plano: **`frame`**. Pacotes `@frame/*`, CLI `frame`.

**Onde fica:** o repositório é novo e **independente**, fora do `video_AC`, como pasta irmã dentro de `Automid`:

```
Automid/
├── video_AC\      ← projeto atual (Remotion). NÃO será alterado.
└── frame\         ← NOVO projeto (repo git próprio, package.json próprio)
```

Nada será criado ou modificado dentro de `video_AC`. Ele serve apenas como referência de leitura.

> ⚠️ Podemos usar as **ideias** do Remotion, mas não copiar código dele. A licença do Remotion não é open source para empresas. Toda a implementação é nossa.

---

## 1. Arquitetura geral

```
┌────────────── Navegador (localhost) ──────────────┐
│  Editor (React)                                   │
│  ├─ Biblioteca │ Preview/Canvas │ Inspetor         │
│  └─ Timeline multitrilha                          │
│        │  lê/escreve                              │
│        ▼                                          │
│  Store do projeto (Zustand + Immer patches)       │
│        │  renderiza                               │
│        ▼                                          │
│  Renderer  (doc + frame → DOM)  ◄── mesmo código ─┼──┐
└────────┬──────────────────────────────────────────┘  │
         │ HTTP + WebSocket                            │
┌────────▼────────── Servidor local (Node) ──────────┐ │
│  Projetos no disco · Biblioteca de mídia · Watcher │ │
│  Fila de export → Chromium headless ───────────────┼─┘
│                   captura frames → FFmpeg → MP4    │
└────────────────────────────────────────────────────┘
```

**Princípio central:** o **documento do projeto (JSON)** é a única fonte da verdade.
- O editor apenas edita o documento.
- O código (SDK) apenas gera o documento, ou registra componentes.
- O renderer é uma função pura: `(documento, frame) → pixels`. Preview e export usam **o mesmo renderer**, então o que você vê é o que sai no MP4.

**Por que o renderer é DOM/React e não Canvas/WebGL:**
- componentes de marca feitos por código são triviais de escrever em React;
- CSS resolve texto, máscaras e filtros;
- o export é determinístico via Chromium headless.

Para vídeo, cada fase usa uma estratégia:
- **na preview** usamos `<video>` nativo, sincronizado ao playhead, porque é rápido;
- **no export** usamos decodificação frame-exata com WebCodecs (lib `mediabunny`) desenhando em `<canvas>`, porque é preciso.

---

## 2. Monorepo e pacotes

pnpm workspaces + Turborepo, tudo em TypeScript.

| Pacote | Responsabilidade |
|---|---|
| `@frame/schema` | Tipos e validação (zod) do documento, **versionamento e migrações** (`v1 → v2`), ids, utilitários de tempo |
| `@frame/core` | Runtime de animação determinística: `useFrame`, `interpolate`, `Easing`, `spring`, avaliador de keyframes, `<Sequence>`, `<Fill>`, `<Img>`, `delayRender`/`continueRender`, `staticFile`/`asset()` |
| `@frame/renderer` | `<ProjectRenderer doc frame>`: monta trilhas/clipes, aplica transform/opacidade/máscara/blend/efeitos/transições, e um registro de tipos de elemento |
| `@frame/media` | ffprobe (metadados), thumbnails, filmstrip, waveform (peaks), proxies de baixa resolução, decoder frame-exato (mediabunny), hash para dedupe |
| `@frame/audio` | Mix de preview (Web Audio: ganho, fades, keyframes de volume, velocidade) e *filtergraph* equivalente em FFmpeg para o export |
| `@frame/editor` | O app CapCut-like (Vite + React) |
| `@frame/server` | Servidor local (Hono): API de projetos e assets, WebSocket, watcher (chokidar), fila de render |
| `@frame/export` | Playwright/Chromium headless: abre o renderer em modo export, captura os frames, envia por pipe para o FFmpeg, faz render paralelo em chunks e mux do áudio |
| `@frame/sdk` | Autoria por código: `defineProject`, `track`, `clip`, `text`, `defineComponent({ schema, render })`, `defineTemplate` |
| `@frame/cli` | Comandos `frame studio`, `frame render <proj>`, `frame new`, `frame check`, `frame still` |
| `@frame/brand-automind` | Pack da marca: tokens (6 cores, gradiente acento, cantos retos), fontes Hando + Red Hat, presets de texto, logos, TruckArt, templates |
| `create-frame` | `npx create-frame meu-projeto` gera um workspace pronto para um colega |

Dependências-chave:
- **Editor:** React 19, Vite, Zustand + Immer, zod, Radix UI + Tailwind, `@dnd-kit` (biblioteca → timeline).
- **Timeline:** pointer events próprios na timeline, e canvas para régua, waveforms e thumbnails.
- **Servidor e export:** Hono, chokidar, Playwright, `ffmpeg-static` + `ffprobe-static` (ninguém precisa instalar o FFmpeg na mão).
- **Testes:** Vitest, Playwright Test, pixelmatch.

---

## 3. Formato do projeto (a decisão mais importante)

Um projeto é uma **pasta**:

```
meu-video/
├── project.json        ← documento (fonte da verdade)
├── assets/             ← mídia local do projeto (ou referências à biblioteca global)
├── components/         ← componentes em código (opcional)
├── .frame/cache/       ← proxies, thumbs, waveforms (fica fora do git)
└── .frame/history/     ← snapshots de versões
```

Estrutura do documento (resumida):

```ts
Project {
  schemaVersion: 1
  settings: { width, height, fps, background, format: 'reel-9x16'|'feed-4x5'|'square-1x1'|'landscape-16x9'|'custom' }
  assets: Asset[]            // { id, kind: video|image|audio|font|lottie, src, hash, meta{duration,w,h,…} }
  tracks: Track[]            // { id, kind: main|overlay|text|audio|effect, locked, hidden, muted, clips: Clip[] }
  markers: Marker[]          // { frame, label, color }  (+ beatGrid opcional)
  captions?: CaptionTrack[]
}
Clip {
  id, type: 'video'|'image'|'audio'|'text'|'shape'|'component'|'effect'|'adjustment'
  start, duration            // em frames inteiros do projeto
  assetId?, trimIn?, speed?  // recorte da mídia de origem
  transform: { x, y, scale, rotation, anchorX, anchorY }
  opacity, blendMode, mask?
  keyframes: { [propPath]: Keyframe[] }   // { frame, value, easing }
  props: {...}               // texto/estilo ou props do componente (validadas pelo schema do componente)
  effects: Effect[]          // filtros, blur, cor, chroma key…
  transitionIn?, transitionOut?, animationIn?, animationOut?, animationLoop?
  audio?: { volume, fadeIn, fadeOut, pan }
}
```

Regras do formato:
- O tempo é **frame inteiro**. A mídia de origem é medida em segundos e convertida.
- Cada tipo de clipe corresponde a um **Element Type** registrado no renderer. Esse registro declara o schema de props, que é usado para gerar o inspetor automaticamente.
- Todo `project.json` carrega `schemaVersion`. Uma mudança de formato exige uma migração com teste.

---

## 4. Editor — funcionalidades (paridade CapCut)

**Layout:**
- topo: barra de ferramentas;
- esquerda: biblioteca com abas Mídia / Texto / Áudio / Stickers / Efeitos / Transições / Templates / Componentes;
- centro: preview/canvas;
- direita: inspetor;
- base: timeline.

### Timeline
- Multitrilha, com **trilha principal magnética** (sem buracos), overlays livres e trilhas de áudio.
- Mover, trim nas bordas, **split (S)**, ripple delete, duplicar, copiar e colar, multisseleção por laço.
- Snapping em playhead, bordas de clipes, marcadores e **grid de batida (BPM)**.
- Zoom e rolagem, régua em timecode ou frames.
- Por trilha: lock, hide e mute.
- Filmstrip de vídeo e waveform de áudio.
- Losangos de keyframe nos clipes. Transições arrastadas para a junção entre clipes.
- Virtualização, para aguentar centenas de clipes.

### Canvas / preview
- Selecionar, mover, escalar e rotacionar com handles. Guias de alinhamento e snapping entre elementos.
- Overlay de **safe zones por formato**.
- Edição de texto **inline** (duplo clique).
- Zoom e pan. Alternância de qualidade entre proxy e original.
- Play/pause, J/K/L, frame a frame com ←/→, loop de região in/out.

### Inspetor
- Gerado a partir do schema do tipo ou componente, em seções: Básico, Transform, Texto, Animação, Áudio, Efeitos.
- Botão ◆ de keyframe por propriedade e editor de curva de easing (bezier e presets).

### Texto
- Fontes, com as da marca pré-carregadas.
- Estilos: cor, contorno, sombra, fundo e espaçamento.
- Presets de estilo da marca.
- Animações de entrada, saída e loop (ex.: kinetic word-by-word, typewriter, fade/slide/scale).
- **Legendas automáticas** a partir do áudio, com Whisper local (`whisper.cpp` ou `transformers.js`) e destaque palavra a palavra.

### Áudio
- Volume, fade in/out, keyframes de volume, velocidade com preservação de tom.
- Ducking automático sob a locução.
- Gravar locução pelo microfone.
- **TTS integrado** (ElevenLabs e Edge TTS), gerando o clipe já com os timestamps das palavras.
- Detecção de batida para gerar marcadores.

### Mídia e efeitos
- Velocidade (constante, com curva numa fase posterior) e congelar frame.
- Crop, espelhar, máscaras (retângulo/círculo/linear) e chroma key.
- Filtros de cor, ajustes (brilho, contraste, saturação, temperatura) e blur.
- Camada de ajuste que afeta tudo que está abaixo.

### Fluxo
- Undo/redo ilimitado, via patches do Immer em um command stack.
- Autosave com debounce e **histórico de versões** (snapshots em `.frame/history`).
- Atalhos de teclado iguais aos do CapCut e editáveis.
- Templates com slots editáveis: salvar a seleção como template e aplicar depois.
- Diálogo de export: formato, resolução, fps, qualidade/CRF e codec (H.264/H.265/ProRes/GIF/PNG sequence), fila com barra de progresso, export de still/capa.

---

## 5. Banco de mídia

- **Global** (compartilhado entre projetos): uma pasta configurável, que pode ser uma pasta de rede da empresa, com um índice `library.json` (ou SQLite via `better-sqlite3`) guardando tags, pastas, favoritos e busca.
- **Por projeto:** `assets/`, ou referências por hash à biblioteca global. No export, a opção "coletar mídia" copia tudo para dentro do projeto.
- Na importação (drag and drop ou botão):
  - calcula o hash (dedupe);
  - lê os metadados com ffprobe;
  - gera thumbnail, filmstrip, waveform e proxy em background, com a fila mostrada na UI.
- Categorias: vídeos, imagens, áudios/música, SFX, fontes, stickers, Lottie e packs de marca.
- O cache fica em um local configurável, porque o C: desta máquina tem pouco espaço. Há também um comando `frame cache clean`.

---

## 6. Framework de código (SDK)

Existem dois modos, que convivem.

**a) Gerar projeto por código.** Um script chama o SDK e escreve o `project.json`. É o caminho para IA e automação (roteiro → vídeo):

```ts
export default defineProject({ format: 'reel-9x16', fps: 30 }, (p) => {
  const vo = p.audio(asset('vo/cena1.mp3'))
  p.text({ text: 'Conheça o AutoChecker', preset: 'brand/title', at: vo.word('AutoChecker') })
  p.component(TruckScene, { from: 0, duration: sec(3), props: { direction: 'right' } })
})
```
- `frame build` roda o script e gera o JSON, que abre no editor.
- Se o script roda de novo depois de uma edição no editor, o **editor mostra um diff** e pergunta se deve sobrescrever. Por padrão, os clipes gerados por código ficam marcados com `origin: 'code'`.

**b) Componentes por código.** São elementos customizados com schema de props:

```ts
export const TruckScene = defineComponent({
  name: 'TruckScene',
  schema: z.object({ direction: z.enum(['left','right']), color: brandColor() }),
  render: ({ direction, color }) => { const f = useFrame(); /* … */ },
})
```
- O componente aparece na aba "Componentes" da biblioteca.
- As props ficam editáveis no inspetor.
- Tem hot reload (Vite HMR) enquanto o dev programa.

Ideias do `video_AC` que vamos **reimplementar** no `@frame/core` e no SDK. É só referência conceitual, sem dependência entre os projetos:
- **Timeline por segmentos e grid de batida:** `defineTimeline`, `beatGrid` em `src/core/timing/`.
- **Movimento:** dicionário de easings e presets de spring em `src/core/easing/`.
- **Texto e transições:** primitivas `KineticText`, `CountUp`, `IrisWipe`/`MaskWipe` em `src/core/primitives/`. Viram presets de animação e transição.
- **Formatos:** presets de formato e safe zones em `src/formats/`.
- **Timeline elástica guiada por locução:** timestamps de palavra em `src/compositions/AutoCheckerViral/timeline.ts`.
- **Pipeline de áudio:** `scripts/audio/voiceover.py` e `master.ts`, com Edge TTS/ElevenLabs, trim, normalização em −16 LUFS e mux.
- **Qualidade:** a lint de determinismo (`tests/lint.ts`) e o teste de regressão por pixel (`tests/regression.ts`).

---

## 7. Export (render final)

1. O servidor abre `/_render?project=…` no Chromium headless, com viewport igual à resolução do projeto.
2. Para cada frame: `setFrame(n)` → aguarda `delayRender`, com fontes (`document.fonts.ready`), imagens e decode de vídeo prontos → screenshot (JPEG/PNG), enviado por pipe para o FFmpeg (`image2pipe`).
3. Render paralelo com N abas/workers, cada uma com um intervalo de frames. Depois, `concat` dos chunks.
4. **O áudio é mixado à parte** pelo FFmpeg (filtergraph gerado a partir do documento) e depois muxado com offset explícito. Isso vem da lição do `video_AC`: o AAC do render saía cerca de 42,7 ms atrasado.
5. O progresso vai por WebSocket para a fila de export no editor.

Alternativa futura: export 100% no navegador via WebCodecs. Fica para depois do MVP.

---

## 8. Roadmap por fases

Cada fase termina com algo usável.

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0 — Fundações** | Monorepo, `@frame/schema` v1, `@frame/core` (frame, interpolate, easing, spring, keyframes), esqueleto de CLI e servidor, CI (tsc + vitest + lint de determinismo) | `frame studio` abre uma página em branco servindo um projeto de exemplo |
| **1 — Renderer + Export MVP** | Tipos text/image/video/audio/shape, transform/opacidade/keyframes, player na preview, export Chromium+FFmpeg com mix de áudio | Um `project.json` escrito à mão vira MP4 idêntico à preview (teste pixel e sincronia A/V ok) |
| **2 — Editor MVP** | Layout, biblioteca de mídia (import, thumbs, waveform), timeline (mover/trim/split/snap/multitrilha), canvas (mover/escalar/girar/guias), inspetor, edição de texto, undo/redo, autosave, atalhos | Um colega monta um vídeo de 30 s sem tocar em código e exporta |
| **3 — Nível CapCut** | Keyframes com curvas, animações de texto, transições, efeitos e filtros, máscaras, velocidade, fades e ducking de áudio, gravação de locução, TTS, legendas automáticas, proxies | Paridade com a checklist da seção 4 |
| **4 — Código + Marca** | `@frame/sdk` (defineProject/defineComponent/templates), hot reload de componentes, diff código × editor, `@frame/brand-automind`, templates da marca | Um script gera um vídeo com locução e timestamps que abre e é editável no editor |
| **5 — Compartilhar** | `create-frame`, publicação em registry privado (GitHub Packages), docs (guia do usuário + guia do dev), vídeo-tutorial, testes E2E, otimização | Colega em outra máquina Windows instala e usa seguindo só o README |
| Futuro | Colaboração em tempo real (Yjs), render na nuvem, app desktop (Tauri), plugins de terceiros | — |

---

## 9. Riscos técnicos e mitigação

| Risco | Mitigação |
|---|---|
| Seek impreciso de `<video>` no navegador | O export usa decode frame-exato com WebCodecs/mediabunny. A preview aceita pequena imprecisão durante o play e fica exata quando pausada. |
| Dessincronia de áudio e vídeo | Áudio mixado à parte no FFmpeg, mux com offset explícito, e um teste automático de "claquete" (flash + beep) |
| Performance da preview com muitas camadas ou 4K | Proxies de baixa resolução, virtualização da timeline, montar só os clipes ativos no frame |
| Render lento | Workers paralelos em chunks, JPEG quando não há alfa, cache de frames estáticos |
| Não-determinismo (Date, random, transições CSS) | `core` expõe `random(seed)`, a lint proíbe essas APIs, e a regressão por pixel roda no CI |
| Fontes/imagens ainda não carregadas no frame capturado | `delayRender` obrigatório nos loaders, e `document.fonts.ready` antes de cada captura |
| Conflito entre edição por código e no editor | `origin: 'code'` nos clipes, diff visual antes de sobrescrever, versões salvas |
| Formato do projeto mudar e quebrar vídeos antigos | `schemaVersion` + migrações testadas desde a v1 |
| Portabilidade no Windows (paths, FFmpeg) | `ffmpeg-static`, paths normalizados, CI com runner Windows |

---

## 10. Verificação (como provar que funciona)

- **Unitários (Vitest):**
  - schema e migrações;
  - `interpolate`, `spring` e keyframes;
  - operações da timeline (split, trim, ripple, snap) como funções puras sobre o documento;
  - undo/redo.
- **Golden renders:** projetos de fixture em `fixtures/`. O `frame render` gera frames e compara com os baselines via pixelmatch, com tolerância zero, como em `video_AC/tests/regression.ts`.
- **Preview = Export:** captura o frame N da preview (Playwright) e o frame N do MP4 (FFmpeg) e compara os dois.
- **Sincronia A/V:** uma fixture com claquete, verificada por detecção de pico no áudio × frame do flash (tolerância ≤ 1 frame).
- **E2E do editor (Playwright Test):**
  1. importar mídia;
  2. arrastar para a timeline;
  3. split;
  4. editar texto;
  5. mover no canvas;
  6. exportar;
  7. validar a duração e a resolução do MP4 com ffprobe.
- **Teste de aceitação humano por fase:** um colega sem experiência em código executa a tarefa do critério de pronto.

---

## 11. Primeiro passo concreto (ao aprovar)

1. Criar `Automid/frame` (fora do `video_AC`) com `git init`, pnpm + Turborepo, TS strict e CI.
2. Escrever `@frame/schema` v1 com zod, os 3 projetos de fixture e os testes.
3. Escrever `@frame/core` (frame, interpolate, easing, spring, keyframes) com testes.
4. Fazer o spike de risco da fase 1: um vídeo MP4 dentro de um projeto, com export frame-exato e áudio sincronizado. Se esse spike passar, a arquitetura está validada.
