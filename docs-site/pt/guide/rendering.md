---
title: Render
description: Renderize projetos Caju Motion localmente em MP4, MOV ProRes, WebM, GIF ou quadros PNG com caju render e caju still - configurações, desempenho, API HTTP e verificação do resultado.
---

# Render

## Como funciona

- O renderer abre o projeto num Chromium headless e desenha **um frame exato por vez**.
- Ele espera fontes, imagens e quadros de vídeo ficarem prontos (a trava `delayRender`), captura o frame e o envia ao FFmpeg, em ordem.
- O áudio é mixado à parte a partir do documento (volume, fades, corte, velocidade) e unido a partir de t = 0. Atraso A/V medido: 0 ms.

Requisitos:

- Um navegador Chromium: Chrome ou Edge instalado, ou `CAJU_BROWSER_PATH`. Não há download de navegador.
- FFmpeg: embutido (`ffmpeg-static`), ou `CAJU_FFMPEG_PATH`.
- Só no checkout do repositório: compile o Studio uma vez com `npm run build -w @caju-motion/studio` (e de novo após mudar o Studio). Os pacotes instalados já vêm com ele pronto.

## Comandos

```bash
caju render <id> [--out saida.mp4] [--format mp4-h264] [--resolution 1080] [--fps 30] \
                 [--quality high] [--no-audio] [--concurrency 2] [--dir projects]
caju still  <id> --frame <n> [--out quadro.png] [--resolution 1080] [--dir projects]
```

- Saída padrão: `<projeto>/renders/<id>-<timestamp>.<ext>`.
- Ctrl+C cancela e apaga o arquivo parcial.
- `--serve-url http://localhost:3700` reaproveita um Studio aberto em vez de subir um servidor interno.
- No **Studio**, o botão **Exportar** salva as edições pendentes e renderiza com progresso, cancelamento e download.

## Configurações de exportação

### Formato

| `--format` | Codec | Use para |
|---|---|---|
| `mp4-h264` (padrão) | H.264 + AAC | tudo: redes, web, mensageiros, apresentações |
| `mp4-h265` | HEVC | arquivos menores para aparelhos modernos |
| `mov-prores` | ProRes 422 | entregar para edição (Premiere, Resolve, Final Cut) |
| `webm-vp9` | VP9 + Opus | vídeos embutidos na web |
| `gif` | GIF, sem áudio | loops curtos < 10 s, ≤ 720p |
| `png-seq` | quadros PNG, sem áudio | composição, revisão quadro a quadro |

### Resolução

`--resolution` é o **lado menor**: `720`, `1080` (nativa em todos os formatos), `1440` (2K), `2160` (4K). A saída mantém a proporção, arredondada para números pares. Aumentar a resolução não cria detalhe.

### FPS

`24`, `25`, `30`, `50`, `60` no Studio; qualquer inteiro de 1 a 120 na CLI. Use o `settings.fps`: mudar o fps na exportação descarta ou duplica quadros.

### Qualidade

| `--quality` | No Studio | CRF H.264 | Uso |
|---|---|---|---|
| `draft` | Rascunho | 28 | revisão rápida |
| `good` | Boa | 23 | web |
| `high` (padrão) | Alta | 18 | redes / entrega final |
| `max` | Máxima | 14 | arquivo, reedição |

O H.265 usa CRF + 5 para o mesmo visual; o VP9 usa 40 / 34 / 28 / 22. ProRes, GIF e PNG não usam CRF.

### Guia por plataforma

| Plataforma | Formato do projeto | Configuração |
|---|---|---|
| Reels / TikTok / Shorts | `reel-9x16` | mp4-h264, 1080, 30 fps, high |
| Feed do Instagram | `feed-4x5` | mp4-h264, 1080, 30 fps, high |
| YouTube / LinkedIn / slides | `landscape-16x9` | mp4-h264, 1080 (ou 2160), 30 fps, high |

## Desempenho

- Cerca de 5–10 frames/s em 1080p com 2 páginas, mais 8–15 s para abrir o navegador. Um reel de 60 s leva uns 3–6 min.
- A concorrência é limitada a 2 páginas. Em máquinas com pouca memória, use `--concurrency 1`.
- Clipes de vídeo usam o decodificador do navegador: exatos para H.264 com taxa constante. Converta fontes com taxa variável antes ([Assets](./assets#video)).
- Um render por vez em cada Studio; os outros entram na fila.

## API HTTP

Com o Studio rodando:

| Requisição | Devolve |
|---|---|
| `POST /api/projects/:id/render` com as configurações (JSON) | um job |
| `GET /api/render/jobs/:job` | o status do job |
| `GET /api/render/jobs/:job/file` | o arquivo renderizado |
| `GET /api/projects/:id/still?frame=N` | um still PNG |

O corpo aceita `{ format, resolution, fps, quality, audio }`; campos ausentes usam o padrão do projeto.

## Verifique o resultado

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate -of json out/promo.mp4
```

1. **Duração** ≈ duração do projeto / fps, com tolerância de 1 frame (`settings.duration`, ou o fim do último clipe).
2. **Resolução** e **fps** iguais aos escolhidos.
3. **Faixa de áudio** presente quando o projeto tem áudio e ele foi habilitado; 48000 Hz.
4. **Loudness** da mixagem em torno de −14 a −16 LUFS para redes:
   ```bash
   ffmpeg -i out/promo.mp4 -af ebur128=framelog=quiet -f null - 2>&1 | grep -A2 "Integrated"
   ```
5. **Sincronia A/V:** extraia o quadro de um evento sonoro conhecido. O fixture `fixtures/projects/landscape-audio` do repositório (flash branco + bipe no frame 30) é a referência.
6. **Conferência visual** nas trocas de cena:
   ```bash
   ffmpeg -ss 00:00:03.000 -i out/promo.mp4 -frames:v 1 out/check-3s.png
   ```

## Disponibilidade (v0.2)

| Recurso | Status |
|---|---|
| MP4 H.264/H.265, MOV ProRes, WebM VP9, GIF, sequência PNG | ✓ |
| Stills (PNG) | ✓ |
| Clipes de componentes próprios | ✓ (carregados de `components/`) |
| Render em nuvem / distribuído | planejado (F4) |
