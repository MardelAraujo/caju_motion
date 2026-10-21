---
title: Conceitos
description: O modelo mental do Caju Motion - project.json como única fonte da verdade, frames inteiros, trilhas e clipes, origin code vs editor e render determinístico.
---

# Conceitos

## Um documento, três autores

Um vídeo é **um documento JSON, o `project.json`**:

- o **código** o gera (`video.ts` + `defineProject`, depois `caju build`);
- o **Caju Studio** o edita numa timeline multi-trilha;
- o **renderer** o desenha frame a frame com React. O mesmo código roda na preview e na exportação.

O que não está no documento não aparece no vídeo.

```text
video.ts ──caju build──▶ project.json ◀──salvar── Caju Studio
                              │
                              ▼
                 renderer (React, frame N) ──▶ caju render ──▶ MP4
```

## Frames, não segundos

- Todo tempo é um **frame inteiro** em `settings.fps` (30 por padrão): `start`, `duration`, `trimIn`, `frame` dos keyframes, `fadeIn`/`fadeOut` de áudio, `frame` dos marcadores.
- Segundos → frames: `Math.round(segundos * fps)` (`p.sec(segundos)` no `video.ts`). Para áudio, use `Math.ceil` para nunca cortar o fim.
- Um clipe está ativo no intervalo meio-aberto `[start, start + duration)`.
- **O `frame` dos keyframes é relativo ao início do clipe**: mover o clipe move a animação. Vale `0 <= frame < duration`.

## Projeto, trilhas, clipes

| Nível | Contém |
|---|---|
| Projeto | `settings` (formato, largura, altura, fps, fundo, duração opcional), `assets[]`, `tracks[]`, `markers[]`, `meta` |
| Trilha | `kind` (`main`, `overlay`, `text`, `audio`), `clips[]`, `locked`/`hidden`/`muted` |
| Clipe | `type`, `start`, `duration`, `transform`, `opacity`, `blendMode`, `props`, `keyframes`, `audio`, `origin` |

- As trilhas empilham **de baixo para cima**: `tracks[0]` é desenhada primeiro (o fundo).
- **Clipes da mesma trilha nunca se sobrepõem.** O que coexiste no tempo vai em trilhas separadas.
- Clipes de áudio só em trilhas `audio`, e trilhas de áudio só têm áudio.
- Tipos de clipe: `text`, `shape`, `image`, `video`, `audio`, `component`, mais `effect` (sobreposição em tela cheia, como uma vinheta) e `adjustment` (filtra tudo o que está abaixo). Qualquer clipe visual também aceita transições, animações e efeitos ([Animação](./animation#presets-de-movimento)).

Lista completa de campos: [schema do project.json](../reference/project-json).

## `origin`: código vs. editor

| `origin` | Feito por | No `caju build` |
|---|---|---|
| `"code"` | `video.ts` (ou outro gerador) | Regenerado. Se alguém o editou no Studio, o build para e reporta um **conflito** |
| `"editor"` (padrão) | Caju Studio | **Preservado** |

Um projeto foi **editado por uma pessoa** quando `meta.updatedAt` existe e difere de `meta.createdAt`. O Studio reescreve `updatedAt` a cada save; geradores nunca escrevem esses campos. Detalhes: [Caju Studio](./studio).

## Determinismo

O renderer pode desenhar o frame 900 antes do 10, em abas paralelas, e redesenhar qualquer frame a qualquer momento. Por isso **os pixels dependem só de `(projeto, frame)`**:

| Proibido no código de render | Use |
|---|---|
| `Math.random()` | `random(semente)` / `randomRange(semente, min, max)` |
| `Date.now()`, `new Date()`, `performance.now()` | o frame (`useFrame()`) |
| `setTimeout`, `setInterval`, `requestAnimationFrame` | o frame |
| CSS `transition` / `animation` / `@keyframes` | `interpolate()` / `spring()` |
| formatação `Intl.*` | formatação manual (o locale da máquina varia) |

O `caju check` roda a lint de determinismo nos seus `components/`; no repositório, `npm run lint` faz o mesmo nos pacotes. Uma exceção justificada leva um comentário `frame-lint-allow` na mesma linha.

## Formatos

| Formato | Tamanho | fps |
|---|---|---|
| `reel-9x16` | 1080×1920 | 30 |
| `feed-4x5` | 1080×1350 | 30 |
| `square-1x1` | 1080×1080 | 30 |
| `landscape-16x9` | 1920×1080 | 30 |

Cada formato tem safe areas: veja [Formatos e safe areas](../reference/formats).
