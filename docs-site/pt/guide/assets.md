---
title: Assets
description: Prepare e registre imagens, SVG, vídeo, fontes e dados num projeto Caju Motion - estrutura de pastas, formatos, tamanhos, metadados e receitas de ffmpeg.
---

# Assets

Cada asset é um **arquivo dentro da pasta do projeto** mais uma **entrada em `project.json` → `assets[]`**. Os clipes apontam para o asset pelo `assetId`.

## Registrando um asset

```json
{ "id": "logo-acme", "kind": "image", "name": "Logo ACME", "src": "assets/images/logo-acme.svg",
  "meta": { "width": 800, "height": 240 } }
```

No `video.ts`: `p.asset({ id: 'logo-acme', kind: 'image', src: 'assets/images/logo-acme.svg', meta: { width: 800, height: 240 } })`.

| Campo | Regra |
|---|---|
| `id` | único em **todo o documento** (assets, trilhas, clipes e marcadores dividem o mesmo espaço) |
| `kind` | `image`, `video` ou `audio` (`font` e `lottie` são reservados, ainda não renderizam) |
| `src` | relativo à pasta do projeto, barras normais, **sem URLs** |
| `meta` | **sempre preencha**: `width`/`height` em imagens; `durationSec` em áudio e vídeo; vídeo também `fps` e `hasAudio` |

O renderer dimensiona imagens por `props.width/height`, depois `meta.width/height`, e cai em **1920×1080** — um bug comum. O `caju check` falha quando o `src` não existe no disco.

## Pastas

```text
projects/<id>/assets/
  images/   video/   audio/{vo,music,sfx,amb}/   fonts/   data/
```

Nomes em kebab-case minúsculo ASCII (`logo-acme.svg`, `vo-03-precos.wav`). O id do asset é o nome do arquivo sem extensão, com prefixo do tipo quando houver ambiguidade (`img-hero`, `vo-03`).

## Meça, não chute

```bash
ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of json assets/video/broll-01.mp4
```

Ou deixe o Caju fazer isso: `npx caju media <id>` preenche o `meta` de todos os assets (vídeos, áudios, imagens e SVGs) e gera miniaturas, formas de onda e proxies de edição ([`@caju-motion/media`](../reference/media)). No `video.ts`, use `measureMedia(arquivo)`; não precisa de ffprobe.

## Imagens

| Conteúdo | Formato |
|---|---|
| Logos, ícones, ilustrações chapadas, diagramas | **SVG** (com `viewBox` e `width`/`height` explícitos). PNG se o SVG usa filtros ou fontes |
| Fotos, prints | **JPG** (qualidade 85–90) ou **WebP** |
| Transparência, não vetorial | **PNG** (ou WebP com alpha) |

- Exporte mais ou menos no tamanho que vai ocupar na tela em escala 1, no máximo a resolução do projeto. Vai dar zoom de 1.3×? Exporte 1.3× maior, não 4×. Mantenha cada arquivo abaixo de ~2 MB.
- Texto dentro de SVG usa as fontes do navegador: converta em curvas, ou rasterize, para resultado exato.
- Fundo de tela cheia: `width`/`height` = tamanho do projeto, `x`/`y` = centro, `"locked": true` para os cliques no Studio passarem.

```json
{ "id": "logo", "type": "image", "assetId": "logo-acme", "start": 0, "duration": 90,
  "transform": { "x": 540, "y": 400, "scale": 1 },
  "props": { "width": 600, "height": 180 } }
```

## Vídeo

Celulares e gravadores de tela costumam gerar arquivos com **taxa de quadros variável**, o que deixa o seek impreciso. Normalize para H.264 com taxa constante (o fps do projeto) e keyframes frequentes:

```bash
ffmpeg -i entrada.mov -vf "fps=30,scale=1920:-2" -c:v libx264 -preset medium -crf 18 \
  -g 30 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart assets/video/broll-01.mp4
```

```json
{ "id": "broll-01", "kind": "video", "src": "assets/video/broll-01.mp4",
  "meta": { "durationSec": 15.0, "width": 1920, "height": 1080, "fps": 30, "hasAudio": true } }
```

| Campo do clipe | Significado |
|---|---|
| `trimIn` | frames da origem pulados no início |
| `duration` | frames exibidos na timeline. Mantenha `trimIn + duration * speed <= durationSec * fps` |
| `speed` | velocidade (um clipe 2× de 60 frames de origem dura 30) |
| `audio` | `{ volume, fadeIn, fadeOut }` do som do próprio clipe; `volume: 0` silencia o b-roll sob a locução |
| `props.width/height` | tamanho de exibição |

Clipes de vídeo vão em trilhas `main` ou `overlay`, nunca em trilhas de áudio.

## Fontes

| `props.fontFamily` | Pesos |
|---|---|
| `"Plus Jakarta Sans"` | 400, 500, 600, 700, 800 (padrão; a fonte da marca Caju) |
| `"Red Hat Display"` | 400, 700, 800 |

Qualquer outra família cai no `sans-serif` do navegador e muda de máquina para máquina. Assets de fonte estão planejados. Até lá, se a fonte da marca for obrigatória, renderize o texto como SVG com o texto em curvas (ou PNG) e use como imagem. Num checkout do repositório, fontes que não podem ser redistribuídas podem ir em `packages/studio/public/fonts/local/` (fora do git).

## Disponibilidade (v0.2)

| Asset | Preview (Studio) | Exportação |
|---|---|---|
| imagem (png/jpg/webp/svg) | ✓ | ✓ |
| vídeo (mp4 H.264) | ✓ | ✓ seek exato por frame (converta fontes VFR antes) |
| áudio | ✓ | ✓ mixado pelo FFmpeg ([Áudio](./audio)) |
| font / lottie | reservado | planejado |
| URLs remotas | nunca | nunca |
