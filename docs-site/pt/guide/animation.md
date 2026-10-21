---
title: Animação
description: Animação no Caju Motion - keyframes e easing, mais os presets de movimento (transições, animações de entrada/saída/loop, efeitos, clipes de sobreposição e de ajuste) e os avisos do caju check.
---

# Animação

Três formas de animar:

- **Keyframes** em qualquer clipe, gravados no `project.json`. Escritos pelo `video.ts` ou à mão; tocam no Studio.
- **Presets de movimento**: transições, animações de entrada/saída/loop, efeitos, sobreposições e camadas de ajuste, por nome ([abaixo](#presets-de-movimento)).
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

## Presets de movimento

Presets com nome que o renderer desenha para você, na prévia do Studio e no export. Menos JSON que keyframes, e cada um é um campo só. Funcionam em qualquer clipe visual e se somam aos keyframes.

Rode `caju catalog --query "<visual>"` para buscar o que existe (poses, loops, efeitos, sobreposições, seus componentes, templates).

### Entradas e saídas

`transitionIn` / `transitionOut` e `animationIn` / `animationOut` usam as mesmas **poses**. A entrada acontece nos primeiros `duration` frames; a saída nos últimos, e é a entrada **espelhada**: sai pelo mesmo lado, com o easing espelhado no tempo (uma entrada que desacelera vira uma saída que acelera).

| Pose | Visual | Parâmetros (padrão) |
|---|---|---|
| `fade` | opacidade 0 → 1 | — |
| `slide` | entra deslizando de um lado | `direction` `left`\|`right`\|`up`\|`down` (`left`), `distance` px (`0` = quadro inteiro) |
| `rise` / `drop` | sobe / desce até o lugar, com fade | `distance` px (80) |
| `zoom` | escala `from` → 1, com fade | `from` (0.6) |
| `pop` | escala 0.4 → 1 com overshoot | — |
| `blur` | desfoque → 0, com fade | `amount` px (24) |
| `spin` | gira até 0 enquanto cresce | `degrees` (-90) |
| `wipe` | cortina (clip-path) a partir de um lado | `direction` (`left`) |
| `iris` | círculo que abre do centro | — |

Sinônimos: `push` → slide, `dissolve`/`crossfade`/`fade-in` → fade, `fade-up` → rise, `fade-down` → drop, `scale`/`zoom-in`/`scale-in` → zoom, `reveal` → wipe.

```json
"transitionIn":  { "type": "slide", "duration": 15, "easing": "expoOut", "params": { "direction": "right" } },
"transitionOut": { "type": "fade", "duration": 10 },
"animationIn":   { "preset": "rise", "duration": 18, "params": { "distance": 60 } }
```

- Transições aceitam `easing` opcional e animações aceitam `params.easing` opcional; sem eles, as duas usam o easing da própria pose (`expoOut` em slide/rise/zoom, `backOut` no pop).
- Entrada + saída ≤ duração do clipe (o `caju check` avisa com `CAJU_MOTION_OVERLAP`).
- **Transições não sobrepõem clipes.** Clipes da mesma trilha não se sobrepõem, então cada clipe anima a si mesmo. Para um crossfade ou empurrão de verdade, coloque o clipe que entra numa trilha de sobreposição acima, começando tantos frames antes do corte quanto dura o seu `transitionIn`.

### Loops

`animationLoop` roda enquanto o clipe toca. `duration` é o **período** em frames; `params.amplitude` multiplica a intensidade (padrão 1).

| Loop | Com amplitude 1 |
|---|---|
| `pulse` | escala ±6 % |
| `float` | y ±12 px |
| `wiggle` | rotação ±4° |
| `breathe` | opacidade cai até 75 % |
| `spin` | uma volta por período |

```json
"animationLoop": { "preset": "float", "duration": 90, "params": { "amplitude": 0.8 } }
```

### Efeitos

`effects[]` são filtros CSS no clipe, aplicados em ordem. Cada parâmetro pode ser animado com keyframes em `effects.<id>.<param>`.

| Efeito | Parâmetros (padrão) |
|---|---|
| `blur` | `radius` px (8) |
| `brightness`, `contrast`, `saturate` | `amount` (1.2, 1.2, 1.4) |
| `grayscale`, `sepia`, `invert` | `amount` 0–1 (1, 0.8, 1) |
| `hueRotate` | `degrees` (90) |
| `dropShadow` | `x` (0), `y` (12), `blur` (24), `color` (`#00000080`) |

```json
"effects": [{ "id": "logo-fx1", "type": "dropShadow", "params": { "y": 16, "blur": 32 } }],
"keyframes": { "effects.logo-fx1.blur": [{ "frame": 0, "value": 0 }, { "frame": 20, "value": 32 }] }
```

### Clipes de sobreposição e camadas de ajuste

- **`type: "effect"`**: sobreposição em tela cheia escolhida por `props.effect`, com os parâmetros em `props` (animáveis como `props.<nome>`):

  | `props.effect` | Parâmetros (padrão) |
  |---|---|
  | `vignette` | `amount` (0.6), `color` (`#000000`) |
  | `letterbox` | `ratio` (2.39), `color` (`#000000`) |
  | `colorOverlay` | `color` (`#F47B35`), `opacity` (0.25) |
  | `flash` | `color` (`#FFFFFF`): cheio no início do clipe, apagando até o fim |
  | `grain` | `amount` (0.12), determinístico por frame |

- **`type: "adjustment"`**: aplica os seus `effects[]` a todas as camadas **abaixo** da sua trilha, inclusive o fundo do projeto, enquanto está ativo. Títulos em trilhas acima não são afetados.

### No `video.ts`

```ts
s.text('Olá', { size: 120, weight: 800 }, {
  id: 'titulo', x: 960, y: 540, exit: false,
  animIn: { type: 'rise', dur: 18, params: { distance: 40 } },
  animOut: { type: 'slide', dur: 10, params: { direction: 'left', distance: 200 } },
});
s.image('logo', 600, 180, {
  id: 'logo', x: 960, y: 820,
  transitionIn: { type: 'zoom', dur: 15, easing: 'expoOut', params: { from: 0.85 } },
  loop: { type: 'float', dur: 90, amplitude: 0.5 },
  effects: [{ type: 'dropShadow', params: { y: 16, blur: 32 } }],
});
s.adjust([{ type: 'grayscale', params: { amount: 1 } }], { id: 'flashback' }); // filtra as camadas declaradas antes
s.overlay('vignette', { amount: 0.5 }, { id: 'vinheta' });
```

Use `exit: false` em clipes que têm a própria saída; senão o fade-out padrão da cena se soma.

### Avisos do lint

O `caju check` (e `caju check --json`) aponta o que é válido mas não vai sair como esperado:

| Código | Significado |
|---|---|
| `CAJU_UNKNOWN_TRANSITION`, `CAJU_UNKNOWN_ANIMATION`, `CAJU_UNKNOWN_LOOP`, `CAJU_UNKNOWN_EFFECT` | nome fora do catálogo (o clipe renderiza sem ele) |
| `CAJU_UNKNOWN_OVERLAY` (erro) | clipe de efeito sem `props.effect` válido |
| `CAJU_MOTION_OVERLAP` | entrada + saída maiores que o clipe |
| `CAJU_ADJUSTMENT_EMPTY` | clipe de ajuste sem efeito ativo |
| `CAJU_OFFSCREEN` | âncora do clipe fora do quadro durante toda a duração |
| `CAJU_UNSAFE_AREA` | texto ancorado na margem coberta pela interface da plataforma ([safe areas](../reference/formats)) |
| `CAJU_TEXT_TOO_SMALL` | texto abaixo de ~2,2 % da altura do quadro |
| `CAJU_LOW_CONTRAST` | texto vs fundo abaixo de WCAG 3:1 (texto grande) / 4,5:1 |
| `CAJU_EMPTY_FRAME` | mais de 0,5 s sem nenhum clipe visível |

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
