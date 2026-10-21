---
title: Áudio
description: Locução, música, efeitos e ambiente no Caju Motion - preparo dos arquivos, alvos de loudness, trilhas e papéis, fades, ducking e normalização de loudness automáticos, keyframes de volume e cenas cronometradas pela narração.
---

# Áudio

## O modelo

- Áudio é um asset (`kind: "audio"`) mais um **clipe de áudio** numa trilha `kind: "audio"`. Clipes de áudio só vão em trilhas de áudio, e trilhas de áudio só têm clipes de áudio.
- Clipes da mesma trilha **não se sobrepõem**: música sob a voz, ou dois efeitos ao mesmo tempo, pedem trilhas separadas.
- Por clipe: `start`, `duration`, `trimIn`, `speed` e `audio: { volume ≥ 0, fadeIn, fadeOut, pan }` (fades em frames, lineares).
- **Volume ao longo do tempo:** keyframes em `audio.volume` ([abaixo](#keyframes-de-volume)). O `pan` é aplicado no export.
- **Papéis de trilha:** trilhas de áudio podem ter `role: "voice" | "music" | "sfx"`. A música abaixa sob a voz quando o [ducking](#ducking) está ligado.
- **Mixagem do projeto** (`settings.audio`): ducking automático e normalização final de loudness, no export.
- Mesmo assim, **normalize os arquivos antes de importar**: a mixagem parte de níveis sãos.

## Trilhas

| Id da trilha | Papel | Prefixo | Pasta |
|---|---|---|---|
| `locucao` (ou `audio-vo-0`), `role: voice` | locução | `vo-` | `assets/audio/vo/` |
| `audio-mus-0` (`-1` para crossfades), `role: music` | música | `mus-` | `assets/audio/music/` |
| `audio-amb-0`, `role: music` | ambiente | `amb-` | `assets/audio/amb/` |
| `audio-sfx-0`, `audio-sfx-1`…, `role: sfx` | efeitos | `sfx-` | `assets/audio/sfx/` |

No `video.ts`, o `p.audioClip()` agrupa os clipes nessas trilhas pelo prefixo do id e define o papel (`vo-` → voice, `mus-`/`amb-` → music, `sfx-` → sfx). Sem papel, uma trilha chamada "Locução…" conta como voz e qualquer outra trilha de áudio como música.

## Preparando os arquivos

- **48 kHz**, estéreo (locução pode ser mono). Locução/efeitos em WAV (ou MP3 192 kbps+); música em MP3 256 kbps / AAC.
- Um arquivo por frase ou cena da locução: fica fácil recronometrar e cada um pode ser movido no Studio.

### Alvos de loudness

LUFS integrado, pico real −1,5 dBTP.

| Papel | Normalize o arquivo em | `volume` do clipe |
|---|---|---|
| Locução | −16 LUFS | 1.0 |
| Música de fundo | −16 LUFS | 0.5–0.8 com [ducking](#ducking) automático; 0.12–0.25 sob a voz sem ele |
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

Ligue a mixagem do projeto e mantenha **um clipe de música contínuo**; o export abaixa a música sob a voz com um compressor sidechain (cerca de 10 dB com os padrões):

```json
"settings": {
  "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30,
  "audio": {
    "ducking":  { "enabled": true, "ratio": 6, "threshold": 0.03, "attackMs": 20, "releaseMs": 400 },
    "loudness": { "enabled": true, "targetLufs": -14, "truePeakDb": -1 }
  }
}
```

No `video.ts`: `defineProject({ id, format, audio: { ducking: { enabled: true }, loudness: { enabled: true } } }, …)`.

| Ajuste | Padrão | Significado |
|---|---|---|
| `ducking.ratio` | 6 | quanto a música abaixa (10–12 para música densa) |
| `ducking.threshold` | 0.03 | nível da voz (linear, 0–1) a partir do qual a música abaixa |
| `ducking.attackMs` / `releaseMs` | 20 / 400 | velocidade para abaixar / voltar (suba o release para 600–800 se a música "bombear") |
| `loudness.targetLufs` | −14 | loudness integrado final (−14 para redes/YouTube, −16 para conteúdo falado) |
| `loudness.truePeakDb` | −1 | teto de true peak |

- Voz = trilhas com `role: "voice"`; música = `role: "music"` ou trilhas de áudio sem papel; `role: "sfx"` nunca abaixa. A fala dentro de um clipe de vídeo só comanda o ducking quando a trilha do vídeo tem `role: "voice"`.
- Dê ao clipe de música o volume dos trechos **sem** voz (0.5–0.8); o compressor abaixa sob a voz.
- Ducking e loudness são aplicados no **export**; a prévia do Studio toca os níveis crus.

### Keyframes de volume

Para um crescendo proposital ou um ducking manual, use keyframes em `audio.volume` (frames relativos ao clipe; rampas lineares, `hold` em degrau):

```json
"keyframes": { "audio.volume": [
  { "frame": 0, "value": 0.7 }, { "frame": 85, "value": 0.7 }, { "frame": 100, "value": 0.2 },
  { "frame": 620, "value": 0.2 }, { "frame": 640, "value": 0.7 } ] }
```

Use keyframes de volume ou o ducking automático num clipe de música, não os dois.

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

**Sincronia por palavra** (legendas): marcações de palavra do TTS ou alinhadores (ex.: Whisper com timestamps por palavra) dão o tempo de cada palavra; converta com `Math.round(seg * fps) + inicioDoClipeDeVoz`. Mostre 2–5 palavras por legenda, no máximo 2 linhas, cada bloco ≥ 0,6 s, dentro da safe area. O `caju tts` (voz gerada) e o `caju transcribe` (fala gravada) gravam esses tempos para você: veja [Locução e legendas](./voice-captions).

**Efeitos:** um whoosh começa 3–5 frames antes do pico do movimento; um pop cai exatamente no pico da escala. Não empilhe mais de 2 efeitos sob a voz.

## Checklist

1. Todo asset de áudio tem `meta.durationSec`, e nenhum clipe passa dele: `trimIn + duration * speed <= durationSec * fps`.
2. A voz é inteligível: música abaixada, efeitos não cobrem palavras.
3. Todo clipe que começa ou termina no meio de um som tem fade de 2–3 frames (sem estalos).
4. Nada importante no último 0,5 s: os players cortam o fim.
5. Depois do render, confira loudness e sincronia: [Render → verificar](./rendering#verifique-o-resultado).
