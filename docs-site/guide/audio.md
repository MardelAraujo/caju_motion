---
title: Audio
description: Voice-over, music, sound effects and ambience in Caju Motion - file preparation, loudness targets, track layout and roles, fades, automatic ducking and loudness normalization, volume keyframes and timing scenes to narration.
---

# Audio

## The model

- Audio is an asset (`kind: "audio"`) plus an **audio clip** on a track with `kind: "audio"`. Audio clips only go on audio tracks, and audio tracks only hold audio clips.
- Clips on one track **cannot overlap**: music under voice, or two SFX at once, need separate tracks.
- Per clip: `start`, `duration`, `trimIn`, `speed`, and `audio: { volume ≥ 0, fadeIn, fadeOut, pan }` (fades in frames, linear).
- **Volume over time:** keyframes on `audio.volume` ([below](#volume-keyframes)). `pan` is applied in the export.
- **Track roles:** audio tracks may have `role: "voice" | "music" | "sfx"`. Music ducks under voice when [ducking](#ducking) is on.
- **Project mix** (`settings.audio`): automatic ducking and final loudness normalization, in the export.
- Still **normalize files before importing**: the mix starts from sane levels.

## Track layout

| Track id | Role | File prefix | Folder |
|---|---|---|---|
| `locucao` (or `audio-vo-0`), `role: voice` | voice-over | `vo-` | `assets/audio/vo/` |
| `audio-mus-0` (`-1` for crossfades), `role: music` | music | `mus-` | `assets/audio/music/` |
| `audio-amb-0`, `role: music` | ambience / room tone | `amb-` | `assets/audio/amb/` |
| `audio-sfx-0`, `audio-sfx-1`…, `role: sfx` | sound effects | `sfx-` | `assets/audio/sfx/` |

In `video.ts`, `p.audioClip()` groups clips into these tracks by id prefix and sets the role automatically (`vo-` → voice, `mus-`/`amb-` → music, `sfx-` → sfx). Without a role, a track named "Locução…" counts as voice and any other audio track as music.

## Preparing files

- **48 kHz**, stereo (VO may be mono). VO/SFX as WAV (or MP3 192 kbps+); music as MP3 256 kbps / AAC.
- One file per VO sentence or scene: re-timing stays easy and each can be moved in the Studio.

### Loudness targets

Integrated LUFS, true peak −1.5 dBTP.

| Role | Normalize file to | Clip `volume` |
|---|---|---|
| Voice-over | −16 LUFS | 1.0 |
| Music bed | −16 LUFS | 0.5–0.8 with automatic [ducking](#ducking); 0.12–0.25 under VO without it |
| SFX | −18 LUFS | 0.3–0.7 |
| Ambience | −24 LUFS | 0.2–0.5 |

```bash
# normalize
ffmpeg -i raw/vo-03.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a pcm_s16le assets/audio/vo/vo-03.wav
# trim silence at both edges
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" out.wav
# measure (→ meta.durationSec)
ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/vo/vo-03.wav
```

Timeline frames for audio: `Math.ceil(durationSec * fps)`, so the tail is never cut. MP3s report ~25–50 ms of extra padding; prefer WAV for voice-over.

## Fades

| Role | Fades (frames) |
|---|---|
| VO | `fadeIn` 0–2, `fadeOut` 2–4 |
| Music | `fadeIn` 15–30 at the start, `fadeOut` 30–60 at the end |
| SFX | `fadeOut` 2–6 when cut before the sound ends |

## Ducking

Turn on the project mix and keep **one continuous music clip**; the export ducks it under the voice with a sidechain compressor (about 10 dB with the defaults):

```json
"settings": {
  "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30,
  "audio": {
    "ducking":  { "enabled": true, "ratio": 6, "threshold": 0.03, "attackMs": 20, "releaseMs": 400 },
    "loudness": { "enabled": true, "targetLufs": -14, "truePeakDb": -1 }
  }
}
```

In `video.ts`: `defineProject({ id, format, audio: { ducking: { enabled: true }, loudness: { enabled: true } } }, …)`.

| Setting | Default | Meaning |
|---|---|---|
| `ducking.ratio` | 6 | how hard the music ducks (10–12 for dense music) |
| `ducking.threshold` | 0.03 | voice level (linear, 0–1) above which the music ducks |
| `ducking.attackMs` / `releaseMs` | 20 / 400 | how fast it ducks / comes back (raise release to 600–800 if the music "pumps") |
| `loudness.targetLufs` | −14 | final integrated loudness (−14 for social/YouTube, −16 for spoken content) |
| `loudness.truePeakDb` | −1 | true-peak ceiling |

- Voice = tracks with `role: "voice"`; music = `role: "music"` or audio tracks without a role; `role: "sfx"` is never ducked. Speech inside a video clip drives the ducking only when the video's track has `role: "voice"`.
- Give the music clip its volume for the parts **without** voice (0.5–0.8); the compressor lowers it under the voice.
- Ducking and loudness are applied in the **export**; the Studio preview plays the raw levels.

### Volume keyframes

For a deliberate swell or a manual duck, keyframe `audio.volume` (frames relative to the clip; linear ramps, `hold` steps):

```json
"keyframes": { "audio.volume": [
  { "frame": 0, "value": 0.7 }, { "frame": 85, "value": 0.7 }, { "frame": 100, "value": 0.2 },
  { "frame": 620, "value": 0.2 }, { "frame": 640, "value": 0.7 } ] }
```

Use either volume keyframes or automatic ducking on a music clip, not both.

## Timing scenes to the voice-over

Let narration drive the timeline:

1. One VO file per scene (`vo-01`…`vo-06`); measure each.
2. Scene length = `max(minFrames, voOffset + voFrames + tailFrames)`, with `voOffset` 8–15 frames (visuals settle first) and `tailFrames` 12–20 (a breath).
3. Each scene starts where the previous ends; its VO clip sits at `scene.from + voOffset`.
4. Recompute from the measured durations whenever the VO changes. **Never hard-code frames that depend on audio length.**

```ts
const fps = 30;
let t = 0;
const scenes = vo.map((v) => {
  const frames = Math.ceil(v.durationSec * fps);
  const len = Math.max(60, 10 + frames + 15);
  const s = { id: v.id, from: t, to: t + len, voAt: t + 10, voFrames: frames };
  t += len;
  return s;
});
```

**Word-level sync** (captions): TTS word boundaries or aligners (e.g. Whisper word timestamps) give each word's time; convert with `Math.round(sec * fps) + voClipStart`. Show 2–5 words per caption, at most 2 lines, each chunk ≥ 0.6 s, inside the safe area. `caju tts` (generated voice) and `caju transcribe` (recorded speech) write these timings for you: see [Voice-over and captions](./voice-captions).

**SFX:** a whoosh starts 3–5 frames before the motion peaks; a pop lands exactly on the scale peak. Don't stack more than 2 SFX under a voice.

## Checklist

1. Every audio asset has `meta.durationSec`, and no clip plays past it: `trimIn + duration * speed <= durationSec * fps`.
2. The voice is intelligible: music ducked, SFX don't mask words.
3. Every clip that starts or ends mid-sound has a 2–3 frame fade (no clicks).
4. Nothing important in the last 0.5 s: players cut the tail.
5. After rendering, check loudness and sync: [Rendering → verify](./rendering#verify-the-output).
