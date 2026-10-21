---
title: Schema do project.json
description: Referência do documento project.json do Caju Motion (schemaVersion 1) - settings, assets, trilhas, clipes, transform, keyframes, áudio, marcadores, meta e as regras que o caju check valida.
---

# Schema do `project.json`

O documento é definido com zod em `@caju-motion/schema` (`ProjectSchema`). `schemaVersion` atual: **1**. Campos com padrão podem ser omitidos.

## Exemplo mínimo completo

Um reel de 5 segundos: fundo, logo, título animado, locução e música de fundo.

```json
{
  "schemaVersion": 1,
  "id": "promo-reel",
  "name": "Promo reel",
  "settings": { "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30, "background": "#0C0B0E", "duration": 150 },
  "assets": [
    { "id": "logo-acme", "kind": "image", "name": "Logo", "src": "assets/images/logo-acme.svg", "meta": { "width": 600, "height": 180 } },
    { "id": "vo-01", "kind": "audio", "name": "Locução 1", "src": "assets/audio/vo/vo-01.wav", "meta": { "durationSec": 3.4 } },
    { "id": "mus-bed", "kind": "audio", "name": "Trilha", "src": "assets/audio/music/mus-bed.mp3", "meta": { "durationSec": 30 } }
  ],
  "tracks": [
    {
      "id": "main", "kind": "main", "name": "Fundo",
      "clips": [
        { "id": "bg", "type": "shape", "name": "Fundo", "start": 0, "duration": 150, "locked": true,
          "transform": { "x": 540, "y": 960 },
          "props": { "shape": "rect", "width": 1080, "height": 1920, "fill": "#171512" } }
      ]
    },
    {
      "id": "camada-1", "kind": "overlay", "name": "Logo",
      "clips": [
        { "id": "logo", "type": "image", "assetId": "logo-acme", "start": 0, "duration": 150,
          "transform": { "x": 540, "y": 520 },
          "props": { "width": 600, "height": 180 },
          "keyframes": {
            "opacity": [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 15, "value": 1 }],
            "transform.scale": [{ "frame": 0, "value": 0.8, "easing": "backOut" }, { "frame": 15, "value": 1 }]
          } }
      ]
    },
    {
      "id": "texto-1", "kind": "text", "name": "Título",
      "clips": [
        { "id": "title", "type": "text", "name": "Título", "start": 12, "duration": 138,
          "transform": { "x": 540, "y": 960 },
          "props": { "text": "Code it.\nThen move it.", "fontFamily": "Plus Jakarta Sans", "fontSize": 110, "fontWeight": 800,
                     "color": "#FFF8E9", "align": "center", "lineHeight": 1.1, "letterSpacing": 0, "background": "" },
          "keyframes": {
            "opacity": [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 18, "value": 1 },
                        { "frame": 125, "value": 1, "easing": "easeIn" }, { "frame": 137, "value": 0 }],
            "transform.y": [{ "frame": 0, "value": 1000, "easing": "softOut" }, { "frame": 18, "value": 960 }]
          } }
      ]
    },
    {
      "id": "locucao", "kind": "audio", "name": "Locução",
      "clips": [
        { "id": "vo-01-clip", "type": "audio", "assetId": "vo-01", "start": 15, "duration": 102,
          "audio": { "volume": 1, "fadeIn": 0, "fadeOut": 3 } }
      ]
    },
    {
      "id": "audio-mus-0", "kind": "audio", "name": "Trilha sonora",
      "clips": [
        { "id": "mus-bed-1", "type": "audio", "assetId": "mus-bed", "start": 0, "duration": 150,
          "audio": { "volume": 0.2, "fadeIn": 15, "fadeOut": 30 } }
      ]
    }
  ],
  "markers": [{ "id": "m-title", "frame": 12, "label": "Título entra" }],
  "meta": { "generator": "meu-agente" }
}
```

## Projeto

| Campo | Tipo | Padrão | Notas |
|---|---|---|---|
| `schemaVersion` | `1` | — | obrigatório |
| `id` | string | — | igual ao nome da pasta |
| `name` | string | — | não vazio |
| `settings` | objeto | — | veja abaixo |
| `assets` | `Asset[]` | `[]` | |
| `tracks` | `Track[]` | `[]` | índice 0 = embaixo (desenhada primeiro) |
| `markers` | `Marker[]` | `[]` | |
| `meta` | `{ createdAt?, updatedAt?, generator? }` | `{}` | geradores gravam só `generator` |

## `settings`

| Campo | Tipo | Padrão | Notas |
|---|---|---|---|
| `format` | `reel-9x16` \| `feed-4x5` \| `square-1x1` \| `landscape-16x9` \| `custom` | `custom` | largura/altura precisam bater com o preset ([formatos](./formats)) |
| `width`, `height` | inteiro > 0 | — | px do projeto |
| `fps` | inteiro > 0 | — | 30 em todos os presets |
| `background` | hex | `#000000` | |
| `duration` | inteiro > 0 | fim do último clipe | frames |
| `audio` | `{ ducking?, loudness? }`? | | mixagem do export: música abaixa sob a voz, loudness final ([Áudio](../guide/audio#ducking)) |

## `Asset`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | espaço de nomes global |
| `kind` | `video` \| `image` \| `audio` \| `font` \| `lottie` | `font`/`lottie` reservados |
| `name` | string? | |
| `src` | string | caminho relativo (`assets/...`), barras normais |
| `hash` | string? | |
| `meta` | `{ durationSec?, width?, height?, fps?, hasAudio? }` | padrão `{}`; sempre preencha |

## `Track`

| Campo | Tipo | Padrão |
|---|---|---|
| `id` | string | — |
| `kind` | `main` \| `overlay` \| `text` \| `audio` \| `effect` | — |
| `name` | string? | |
| `locked`, `hidden`, `muted` | boolean | `false` |
| `role` | `voice` \| `music` \| `sfx`? | | trilhas de áudio: quem abaixa quem |
| `clips` | `Clip[]` | `[]` |

## `Clip`

| Campo | Tipo | Padrão | Notas |
|---|---|---|---|
| `id` | string | — | espaço de nomes global |
| `type` | `video` \| `image` \| `audio` \| `text` \| `shape` \| `component` \| `effect` \| `adjustment` | — | `effect` = sobreposição em tela cheia (`props.effect`); `adjustment` filtra as camadas de baixo |
| `name` | string? | | |
| `start` | inteiro ≥ 0 | — | frame |
| `duration` | inteiro ≥ 1 | — | frames |
| `assetId` | string? | | obrigatório em `video`/`image`/`audio` |
| `trimIn` | inteiro ≥ 0 | `0` | frames da origem pulados |
| `speed` | > 0 | `1` | |
| `transform` | objeto | veja abaixo | |
| `opacity` | 0–1 | `1` | |
| `blendMode` | `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `soft-light`, `hard-light`, `difference` | `normal` | |
| `keyframes` | `{ [caminho]: Keyframe[] }` | `{}` | [Animação](../guide/animation) |
| `props` | objeto | `{}` | por tipo (abaixo) |
| `audio` | `{ volume ≥ 0 = 1, fadeIn = 0, fadeOut = 0, pan -1..1 = 0 }`? | | `audio.volume` aceita keyframes |
| `origin` | `editor` \| `code` | `editor` | |
| `locked`, `hidden` | boolean | `false` | |
| `effects` | `{ id, type, enabled = true, params }[]` | `[]` | filtros CSS ([Animação → presets de movimento](../guide/animation#presets-de-movimento)) |
| `transitionIn`, `transitionOut` | `{ type, duration, easing = easeInOut, params }`? | | pose de entrada/saída |
| `animationIn`, `animationOut`, `animationLoop` | `{ preset, duration, params }`? | | pose de entrada/saída; loop (`duration` = período) |

### `transform`

| Campo | Padrão | Notas |
|---|---|---|
| `x`, `y` | `0` | posição da âncora em px do projeto; origem no canto superior esquerdo |
| `scale` | `1` | |
| `rotation` | `0` | graus, sentido horário |
| `anchorX`, `anchorY` | `0.5` | fração da caixa do elemento, 0–1 |
| `flipX`, `flipY` | `false` | |

### `Keyframe`

`{ frame: inteiro ≥ 0 (relativo ao início do clipe), value: number | string, easing = 'linear' }`. Easing: `linear`, `hold`, `easeIn`, `easeOut`, `easeInOut`, `expoOut`, `expoInOut`, `softOut`, `backOut`, ou `{ "bezier": [x1, y1, x2, y2] }`.

### `props` por tipo de clipe

| Tipo | Props |
|---|---|
| `text` | `text` (`\n` quebra linha; não há quebra automática), `fontFamily`, `fontSize`, `fontWeight`, `color`, `align`, `lineHeight`, `letterSpacing`, `background` (hex ou `""`) |
| `shape` | `shape` (`rect` \| `ellipse`), `width`, `height`, `fill`, `stroke` (hex, `#RRGGBBAA` ou `""`), `strokeWidth` |
| `image`, `video` | `width`, `height` (caixa de exibição; sempre defina) |
| `component` | `component` (nome registrado), `width`, `height`, mais as props do componente |

## `Marker`

`{ id, frame: inteiro ≥ 0, label = '', color = '#F6B73C' }`.

## Regras de validação {#regras-de-validacao}

O `caju check` falha em qualquer uma destas:

1. `schemaVersion` precisa ser `1`.
2. **Ids são únicos entre assets, trilhas, clipes e marcadores juntos.** Um clipe e seu asset não podem ter o mesmo id.
3. **Nada de clipes sobrepostos na mesma trilha** (`start < anterior.start + anterior.duration`).
4. Clipes de áudio só em trilhas `audio`, e nada além disso nelas.
5. Clipes `video` / `image` / `audio` precisam de um `assetId` que exista e cujo `kind` seja igual ao `type` do clipe.
6. O `frame` de um keyframe é relativo ao início do clipe e precisa ser `< duration`.
7. Todo campo de frame é inteiro ≥ 0; `duration` ≥ 1; `opacity` e âncoras em 0–1; `audio.volume` ≥ 0.
8. Todo `src` de asset existe no disco, relativo à pasta do projeto.
9. Clipes de componente apontam para um componente que existe em `components/`, e os componentes passam na lint de determinismo.

## `meta` e edições humanas

- `meta.generator` identifica o seu script.
- **Nunca grave `meta.createdAt` / `meta.updatedAt` num gerador.** O `caju new` grava os dois com o mesmo valor; o Studio reescreve `updatedAt` ao salvar. `updatedAt !== createdAt` significa que uma pessoa editou o projeto ([Caju Studio](../guide/studio)).
