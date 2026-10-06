---
title: '@caju-motion/core'
description: Referência da API do runtime de animação do Caju Motion - useFrame, useVideoConfig, Sequence, Fill, interpolate, spring, Easing, cubicBezier, random, delayRender, keyframes e cores.
---

# `@caju-motion/core`

O runtime de animação determinístico usado pelo renderer e pelos seus [componentes](../guide/components). Tudo aqui é função pura do frame.

```ts
import { useFrame, useVideoConfig, Sequence, Fill, interpolate, spring, Easing, random } from '@caju-motion/core';
```

## Hooks de frame

| API | Devolve |
|---|---|
| `useFrame()` | frame atual relativo ao clipe (ou à `<Sequence>` em volta) |
| `useAbsoluteFrame()` | frame absoluto do projeto (ignora `<Sequence>`) |
| `useVideoConfig()` | `{ width, height, fps, durationInFrames }` |

Os hooks precisam rodar dentro do renderer (`FrameProvider`); fora dele, lançam erro.

## `<Sequence>` e `<Fill>`

```tsx
<Sequence from={30} duration={60}>
  <Titulo />  {/* montado nos frames 30–89; useFrame() começa em 0 */}
</Sequence>
```

- `Sequence({ from, duration? })` monta os filhos só em `[from, from + duration)` e desloca o frame para começar em 0. Sequências se aninham. Com `duration`, o `useVideoConfig().durationInFrames` passa a ser essa duração.
- `Fill({ style?, children? })` é uma `div` absoluta que ocupa a caixa inteira (`inset: 0`), base de qualquer camada.

## `interpolate`

```ts
interpolate(input, inputRange, outputRange, { easing?, extrapolateLeft?, extrapolateRight? }): number
```

- Mapeamento linear por partes; `inputRange` precisa ser estritamente crescente e do mesmo tamanho que `outputRange` (≥ 2).
- Extrapolação: `'clamp'` (**padrão** nas duas pontas), `'extend'` ou `'identity'`.
- O `easing` vale dentro de cada trecho.

```ts
const x = interpolate(frame, [0, 20, 40], [0, 300, 250], { easing: Easing.easeInOut });
```

Atalhos: `progress(frame, from, to, easing?)` → 0..1 limitado; `lerp(a, b, t)`.

## `spring`

```ts
spring({ frame, fps, config?, from = 0, to = 1, delay = 0 }): number
```

Mola amortecida **analítica** (fórmula fechada, sem simulação passo a passo): o valor no frame N é função pura de N, então permite seek e é determinística.

| `config` | Padrão (`ui`) |
|---|---|
| `mass` | 1 |
| `stiffness` | 170 |
| `damping` | 26 |
| `overshootClamping` | false |

Presets: `springPresets.ui` (rápida, quase sem overshoot), `settle` (assenta suave, sem pulo), `bouncy` (com pulinho), `heavy` (pesada e lenta).

```ts
const s = spring({ frame, fps, config: springPresets.bouncy, delay: 10 });
```

`springDuration({ fps, config?, threshold = 0.005, maxFrames = 600 })` devolve quantos frames a mola leva para parar.

## Easing

| API | Notas |
|---|---|
| `Easing.linear`, `hold`, `easeIn`, `easeOut`, `easeInOut`, `expoOut`, `expoInOut`, `softOut`, `backOut` | os mesmos presets dos keyframes |
| `cubicBezier(x1, y1, x2, y2)` | como o `cubic-bezier` do CSS; `x1`/`x2` em [0, 1] |
| `resolveEasing(spec)` | transforma o easing do documento (`'expoOut'` ou `{ bezier: [...] }`) em função |

## Aleatório determinístico

| API | Devolve |
|---|---|
| `random(semente)` | número em [0, 1); mesma semente → mesmo número em qualquer máquina |
| `randomRange(semente, min, max)` | número em [min, max) |

Use uma semente estável por elemento, ex.: `random(id + '-' + i)`. Nunca `Math.random()`.

## `delayRender`

```ts
const handle = delayRender('carregando dados do gráfico');
buscarUmaVez().then((dados) => { cache = dados; continueRender(handle); });
```

O exportador só captura o frame quando todos os handles abertos forem fechados. Na preview é só informativo. Avançado: `createRenderGate()` e o `renderGate` global (`delayRender`, `continueRender`, `pending()`, `ready()`).

## Keyframes e cores

Usados pelo renderer; úteis em ferramentas próprias.

| API | Notas |
|---|---|
| `evaluateKeyframes(keyframes, frameLocal)` | valor de uma trilha de keyframes num frame relativo ao clipe |
| `clipValue(clip, caminho, frameDoProjeto, fallback)` | propriedade do clipe com keyframes aplicados |
| `isClipActive(clip, frameDoProjeto)` | `start <= frame < start + duration` |
| `getByPath(obj, 'a.b.c')` | acesso a propriedade aninhada |
| `isHexColor`, `parseHex`, `toHex`, `mixColors(de, para, t)` | `#rgb`, `#rrggbb`, `#rrggbbaa` |
