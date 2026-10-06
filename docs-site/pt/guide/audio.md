---
title: Áudio
description: Locução, música, efeitos e ambiente no Caju Motion - preparo dos arquivos, alvos de loudness, trilhas, fades, ducking sem automação e cenas cronometradas pela narração.
---

# Áudio

## O modelo

- Áudio é um asset (`kind: "audio"`) mais um **clipe de áudio** numa trilha `kind: "audio"`. Clipes de áudio só vão em trilhas de áudio, e trilhas de áudio só têm clipes de áudio.
- Clipes da mesma trilha **não se sobrepõem**: música sob a voz, ou dois efeitos ao mesmo tempo, pedem trilhas separadas.
- Por clipe: `start`, `duration`, `trimIn`, `speed` e `audio: { volume ≥ 0, fadeIn, fadeOut, pan }` (fades em frames, lineares).
- **O volume é fixo por clipe, mais os fades.** Keyframes de volume não são aplicados e o `pan` é gravado mas ainda não aplicado. Para variar o volume, divida o clipe (veja [ducking](#ducking)).
- Não há normalização automática de loudness: **normalize os arquivos antes de importar.**

## Trilhas

| Id da trilha | Papel | Prefixo | Pasta |
|---|---|---|---|
| `locucao` (ou `audio-vo-0`) | locução | `vo-` | `assets/audio/vo/` |
| `audio-mus-0` (`-1` para crossfades) | música | `mus-` | `assets/audio/music/` |
| `audio-amb-0` | ambiente | `amb-` | `assets/audio/amb/` |
| `audio-sfx-0`, `audio-sfx-1`… | efeitos | `sfx-` | `assets/audio/sfx/` |

No `video.ts`, o `p.audioClip()` agrupa os clipes nessas trilhas pelo prefixo do id.

## Preparando os arquivos

- **48 kHz**, estéreo (locução pode ser mono). Locução/efeitos em WAV (ou MP3 192 kbps+); música em MP3 256 kbps / AAC.
- Um arquivo por frase ou cena da locução: fica fácil recronometrar e cada um pode ser movido no Studio.

### Alvos de loudness

LUFS integrado, pico real −1,5 dBTP.

| Papel | Normalize o arquivo em | `volume` do clipe |
|---|---|---|
| Locução | −16 LUFS | 1.0 |
| Música de fundo | −16 LUFS | 0.12–0.25 sob a voz, 0.5–0.8 sozinha |
| Efeitos | −18 LUFS | 0.3–0.7 |
| Ambiente | −24 LUFS | 0.2–0.5 |

```bash
# normalizar
ffmpeg -i bruto/vo-03.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a pcm_s16le assets/audio/vo/vo-03.wav
# cortar o silêncio das pontas
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" out.wav
# medir (→ meta.durationSec)
ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/vo/vo-03.wav
```

Frames de áudio na timeline: `Math.ceil(durationSec * fps)`, para nunca cortar o fim. MP3 reporta ~25–50 ms a mais (padding do encoder); prefira WAV para locução.

## Fades

| Papel | Fades (frames) |
|---|---|
| Locução | `fadeIn` 0–2, `fadeOut` 2–4 |
| Música | `fadeIn` 15–30 no início, `fadeOut` 30–60 no fim |
| Efeitos | `fadeOut` 2–6 quando cortados antes de o som acabar |

## Ducking

Como o volume é fixo por clipe, **divida a música em trechos**, cada um com seu volume, em duas trilhas de música para os trechos se sobreporem num crossfade:

| Trecho | Trilha | Frames | `trimIn` | Volume | Fades |
|---|---|---|---|---|---|
| Intro (sem voz) | `audio-mus-0` | 0 → 95 | 0 | 0.7 | in 20, out 10 |
| Sob a voz | `audio-mus-1` | 85 → 640 | 85 | 0.18 | in 10, out 10 |
| Final | `audio-mus-0` | 630 → 900 | 630 | 0.7 | in 10, out 45 |

O segredo: **`trimIn` = início do trecho**, para a música seguir contínua entre os trechos. As sobreposições (85–95, 630–640) são os crossfades.

## Cenas cronometradas pela locução

Deixe a narração ditar a timeline:

1. Um arquivo de locução por cena (`vo-01`…`vo-06`); meça cada um.
2. Duração da cena = `max(minFrames, voOffset + voFrames + tailFrames)`, com `voOffset` de 8–15 frames (o visual assenta antes) e `tailFrames` de 12–20 (um respiro).
3. Cada cena começa onde a anterior termina; o clipe de locução fica em `cena.from + voOffset`.
4. Recalcule tudo pelas durações medidas sempre que a locução mudar. **Nunca fixe frames que dependem da duração do áudio.**

```ts
const fps = 30;
let t = 0;
const cenas = vo.map((v) => {
  const frames = Math.ceil(v.durationSec * fps);
  const len = Math.max(60, 10 + frames + 15);
  const s = { id: v.id, from: t, to: t + len, voAt: t + 10, voFrames: frames };
  t += len;
  return s;
});
```

**Sincronia por palavra** (legendas): marcações de palavra do TTS ou alinhadores (ex.: Whisper com timestamps por palavra) dão o tempo de cada palavra; converta com `Math.round(seg * fps) + inicioDoClipeDeVoz`. Mostre 2–5 palavras por legenda, no máximo 2 linhas, cada bloco ≥ 0,6 s, dentro da safe area.

**Efeitos:** um whoosh começa 3–5 frames antes do pico do movimento; um pop cai exatamente no pico da escala. Não empilhe mais de 2 efeitos sob a voz.

## Checklist

1. Todo asset de áudio tem `meta.durationSec`, e nenhum clipe passa dele: `trimIn + duration * speed <= durationSec * fps`.
2. A voz é inteligível: música abaixada, efeitos não cobrem palavras.
3. Todo clipe que começa ou termina no meio de um som tem fade de 2–3 frames (sem estalos).
4. Nada importante no último 0,5 s: os players cortam o fim.
5. Depois do render, confira loudness e sincronia: [Render → verificar](./rendering#verifique-o-resultado).
