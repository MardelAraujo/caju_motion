---
title: Animação
description: Keyframes e easing no Caju Motion - caminhos de propriedade, presets de easing, curvas bezier, receitas de entrada/saída e como manter o project.json enxuto.
---

# Animação

Duas formas de animar:

- **Keyframes** em qualquer clipe, gravados no `project.json` (esta página). Escritos pelo `video.ts` ou à mão; tocam no Studio.
- **Código** dentro de um [componente](./components), com `interpolate` / `spring` guiados por `useFrame()`.

## Keyframes

```json
"keyframes": {
  "opacity":     [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 18, "value": 1 }],
  "transform.y": [{ "frame": 0, "value": 1000, "easing": "softOut" }, { "frame": 18, "value": 960 }],
  "props.color": [{ "frame": 30, "value": "#FFFFFF", "easing": "easeInOut" }, { "frame": 45, "value": "#F6B73C" }]
}
```

- As chaves são caminhos de propriedade: `opacity`, `transform.x|y|scale|rotation`, `props.<nome>`.
- `frame` é inteiro e **relativo ao início do clipe**, `< duration`.
- O `easing` fica no keyframe onde o trecho **começa**: ele dá forma ao movimento até o próximo. O easing do último keyframe não é usado.
- Antes do primeiro keyframe vale o primeiro valor; depois do último, o último.
- Números interpolam, cores hex se misturam, outros textos trocam em degrau (ex.: `props.text`).
- Quando um caminho tem keyframes, eles substituem o valor estático enquanto o clipe toca.

No `video.ts`, `enter`/`exit` geram esses keyframes, e `kf` acrescenta outros (frames relativos à cena):

```ts
s.rect(400, 8, { fill: '#F6B73C' }, {
  id: 'linha', x: 340, y: 700, anchorX: 0,
  kf: { 'props.width': [[0, 0, 'easeInOut'], [30, 400]] },
});
```

## Presets de easing

| Preset | Use para |
|---|---|
| `softOut` | entrada padrão (desacelera suave) |
| `expoOut` | entrada rápida, movimentos grandes |
| `backOut` | pops e escalas (leve overshoot) |
| `easeInOut` | ir de uma posição a outra na tela |
| `easeIn` | saídas |
| `easeOut` | desaceleração geral |
| `expoInOut` | transições dramáticas |
| `linear` | movimento constante (letreiros, barras de progresso) |
| `hold` | salta para o próximo valor no próximo keyframe (piscadas, contadores em degrau) |

Curva própria, igual ao `cubic-bezier` do CSS: `"easing": { "bezier": [0.22, 1, 0.36, 1] }`.

## Receitas (30 fps)

| Efeito | Receita |
|---|---|
| Fade + subida | opacidade 0 → 1 e y +16…+40 → y em 15–24 frames, `softOut` |
| Pop | escala 0.6 → 1 em 12–18 frames, `backOut`, junto com um fade |
| Deslize | x ± 80–200 → x, 18–24 frames, `expoOut` |
| Saída | opacidade 1 → 0 nos últimos 8–16 frames, `easeIn`; último keyframe em `duration - 1` |
| Revelar linha | `props.width` 0 → L, 20–35 frames, `easeInOut`, com `anchorX: 0` para crescer à direita |
| Cascata | cada item começa 3–6 frames depois do anterior |
| Ken Burns | escala 1 → 1.12, `linear`, no clipe inteiro |

## JSON enxuto

- Use **2–4 keyframes por propriedade** com presets de easing. Não "assar" todos os frames: o arquivo incha e a edição no Studio fica impossível.
- Para segurar um valor, duplique o keyframe (`frame: 125, value: 1, easing: "easeIn"` → `frame: 137, value: 0`) em vez de criar frames intermediários.

## Em código: `interpolate` e `spring`

```tsx
import { Easing, interpolate, spring, useFrame, useVideoConfig } from '@caju-motion/core';

const frame = useFrame();
const { fps } = useVideoConfig();
const opacity = interpolate(frame, [0, 15], [0, 1], { easing: Easing.softOut }); // limita (clamp) por padrão
const scale = spring({ frame, fps, config: { damping: 12 }, from: 0.6, to: 1 });  // analítico, permite seek
```

Os mesmos presets existem como `Easing.<nome>`. API completa: [@caju-motion/core](../reference/core).

::: info Studio e keyframes
O Studio toca os keyframes, mas ainda não os edita (um editor de keyframes na timeline está planejado). Arrastar um elemento desloca todos os seus keyframes de posição. Escreva a animação em código; deixe as pessoas ajustarem posição, texto e tempo.
:::
