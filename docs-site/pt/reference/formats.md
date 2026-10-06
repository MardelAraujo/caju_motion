---
title: Formatos e safe areas
description: Formatos de projeto do Caju Motion (reel 9:16, feed 4:5, quadrado 1:1, paisagem 16:9) com tamanhos, fps e as margens de safe area cobertas pela interface das plataformas.
---

# Formatos e safe areas

Os formatos são presets de `@caju-motion/schema` (`FORMATS`). O formato define o tamanho e o fps do projeto; `custom` permite qualquer tamanho.

| Formato | Rótulo | Tamanho | fps | Safe top / right / bottom / left (px) |
|---|---|---|---|---|
| `reel-9x16` | Reels / Stories / TikTok (9:16) | 1080×1920 | 30 | 250 / 60 / 420 / 60 |
| `feed-4x5` | Feed (4:5) | 1080×1350 | 30 | 80 / 80 / 80 / 80 |
| `square-1x1` | Quadrado (1:1) | 1080×1080 | 30 | 72 / 72 / 72 / 72 |
| `landscape-16x9` | YouTube / Apresentação (16:9) | 1920×1080 | 30 | 54 / 96 / 120 / 96 |

A **safe area** é o que sobra depois de tirar as margens que a interface da plataforma cobre (legendas, botões, perfil). O Studio a desenha como overlay.

- Mantenha textos e logos inteiros dentro da safe area. Fundos podem vazar.
- Em reels, os 420 px de baixo ficam sob legendas e botões: coloque CTAs por volta de y = 1300–1450.
- Texto nunca quebra sozinho. Estime a largura da linha em ≈ `0.55 × fontSize × caracteres` e quebre com `\n`.
- Títulos ≥ 64 px e texto corrido ≥ 40 px em vídeos de 1080 de largura.

## Coordenadas

- A origem `(0, 0)` é o **canto superior esquerdo** do quadro; `transform.x/y` é onde fica a **âncora** do elemento.
- `anchorX/anchorY` são `0.5, 0.5` (centro) por padrão. Texto alinhado à esquerda usa `anchorX: 0`, para `x` ser a borda esquerda.

```ts
import { FORMATS } from '@caju-motion/schema';
const { width, height, safe } = FORMATS['reel-9x16'];
const areaSegura = { x: safe.left, y: safe.top, w: width - safe.left - safe.right, h: height - safe.top - safe.bottom };
```

## Escolhendo o formato

| Destino | Formato | Exportação |
|---|---|---|
| Reels, TikTok, Shorts, Stories | `reel-9x16` | mp4-h264, 1080 |
| Feed do Instagram / LinkedIn | `feed-4x5` | mp4-h264, 1080 |
| Posts quadrados, anúncios | `square-1x1` | mp4-h264, 1080 |
| YouTube, sites, slides | `landscape-16x9` | mp4-h264, 1080 ou 2160 |

Veja [Render](../guide/rendering#configuracoes-de-exportacao) para todas as opções de exportação.
