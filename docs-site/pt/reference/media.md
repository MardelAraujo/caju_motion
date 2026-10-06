---
title: '@caju-motion/media'
description: Ferramentas de mídia do Caju Motion - caju media preenche os metadados dos assets e gera miniaturas, formas de onda e proxies de edição; probeMedia, thumbnail, waveform, createProxy; decode de vídeo exato por quadro no navegador com WebCodecs.
---

# `@caju-motion/media`

Ferramentas de mídia sobre o FFmpeg que vem com o Caju (`ffmpeg-static`, sem precisar de ffprobe).

## `caju media`

```bash
npx caju media                        # todos os projetos
npx caju media meu-video --proxies auto
```

Para cada asset do projeto ele:

1. lê duração, tamanho, fps e áudio e grava em `asset.meta` no `project.json`, junto com um `hash` do conteúdo (salva com histórico, como o Studio; recusa se o Studio salvou nesse meio-tempo);
2. gera, em `projects/<id>/.caju/media/` (ignorado pelo git):
   - **miniatura** de vídeos e imagens;
   - picos da **forma de onda** de áudios e de vídeos com som, que a timeline do Studio usa direto;
   - **proxy de edição** de vídeos, com `--proxies auto` (só vídeos pesados: acima de ~720 px de altura ou que não são H.264) ou `--proxies all`.

O cache é indexado pelo conteúdo do arquivo: renomear reaproveita, substituir gera de novo. Rodar o comando outra vez só faz o que falta (`--force` refaz tudo; `--dry-run` não grava nada).

**Proxies** são cópias leves em H.264 (540p, um quadro-chave a cada 15) que o Studio toca durante a edição, para que vídeos 4K ou HEVC respondam bem na timeline. O export (`caju render` e o botão Exportar) sempre usa os arquivos originais.

## API (Node)

```ts
import { probeMedia, thumbnail, waveform, createProxy, analyzeProject } from '@caju-motion/media';
```

| Export | |
|---|---|
| `probeMedia(arquivo)` | `{ kind, durationSec, width, height, fps, hasAudio, hasVideo, videoCodec, audioCodec, sampleRate, rotation }`. Largura e altura são as de exibição (com a rotação do celular aplicada). SVGs são lidos pelo `width`/`height` ou pelo `viewBox` |
| `thumbnail(arquivo, { out, atSec?, width? })` | JPG/PNG/WebP de um quadro do vídeo ou da imagem |
| `waveform(arquivo, { perSecond? })` | `{ perSecond, durationSec, peaks }`, picos mono de 0 a 1 |
| `createProxy(arquivo, { out, height?, keyint? })` | proxy de edição (MP4) |
| `hashFile(arquivo)` | SHA-256 do conteúdo |
| `analyzeProject(pastaDoProjeto, projeto, { thumbnails?, peaks?, proxies?, force? })` | o que o `caju media` faz; devolve o projeto atualizado e um relatório por asset (não grava o `project.json`) |
| `findDerived(pastaDoProjeto, src, 'thumb' \| 'peaks' \| 'proxy')` | caminho de um derivado, ou `null` se não existe ou está desatualizado |
| `ffmpegPath()`, `execFfmpeg(args)` | o FFmpeg em uso (`CAJU_FFMPEG_PATH` > `ffmpeg-static` > `PATH`) |

O `measureMedia(arquivo)` do `@caju-motion/sdk` é o `probeMedia`.

## Navegador: decode exato por quadro (experimental)

```ts
import { createFrameDecoder } from '@caju-motion/media/web';

const decoder = await createFrameDecoder('/videos/clip.mp4'); // URL, ArrayBuffer ou Blob
await decoder.drawFrameAt(ctx, 2.5); // o quadro exato que aparece em 2,5 s
const frame = await decoder.frameAt(2.5); // VideoFrame (chame frame.close())
decoder.close();
```

Ele decodifica com WebCodecs a partir do próprio MP4 (sem elemento `<video>`), então `frameAt(t)` devolve o mesmo quadro que o FFmpeg extrairia, inclusive com B-frames e edit lists. Ler para a frente quadro a quadro reaproveita o que já foi decodificado, e voltar no tempo recomeça do quadro-chave anterior. Limites: só MP4/MOV (H.264, H.265, VP9, AV1), e o arquivo inteiro vai para a memória, então use em clipes. Veja o suporte com `isWebCodecsSupported()`.
