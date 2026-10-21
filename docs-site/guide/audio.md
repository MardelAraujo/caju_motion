---
title: Audio
description: Voice-over, music, sound effects and ambience in Caju Motion - file preparation, loudness targets, track layout, fades, ducking without automation and timing scenes to narration.
---

# Audio

## The model

- Audio is an asset (`kind: "audio"`) plus an **audio clip** on a track with `kind: "audio"`. Audio clips only go on audio tracks, and audio tracks only hold audio clips.
- Clips on one track **cannot overlap**: music under voice, or two SFX at once, need separate tracks.
- Per clip: `start`, `duration`, `trimIn`, `speed`, and `audio: { volume ≥ 0, fadeIn, fadeOut, pan }` (fades in frames, linear).
- **Volume is static per clip, plus fades.** Volume keyframes are not applied and `pan` is stored but not applied yet. To change volume over time, split the clip (see [ducking](#ducking)).
- There is no automatic loudness normalization: **normalize files before importing.**

## Track layout

| Track id | Role | File prefix | Folder |
|---|---|---|---|
| `locucao` (or `audio-vo-0`) | voice-over | `vo-` | `assets/audio/vo/` |
| `audio-mus-0` (`-1` for crossfades) | music | `mus-` | `assets/audio/music/` |
| `audio-amb-0` | ambience / room tone | `amb-` | `assets/audio/amb/` |
| `audio-sfx-0`, `audio-sfx-1`… | sound effects | `sfx-` | `assets/audio/sfx/` |

In `video.ts`, `p.audioClip()` groups clips into these tracks by id prefix automatically.

## Preparing files

- **48 kHz**, stereo (VO may be mono). VO/SFX as WAV (or MP3 192 kbps+); music as MP3 256 kbps / AAC.
- One file per VO sentence or scene: re-timing stays easy and each can be moved in the Studio.

### Loudness targets

Integrated LUFS, true peak −1.5 dBTP.

| Role | Normalize file to | Clip `volume` |
|---|---|---|
| Voice-over | −16 LUFS | 1.0 |
| Music bed | −16 LUFS | 0.12–0.25 under VO, 0.5–0.8 alone |
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

Volume is static per clip, so **split the music into segments**, each with its own volume, on two music tracks so segments overlap for a crossfade:

| Segment | Track | Frames | `trimIn` | Volume | Fades |
|---|---|---|---|---|---|
| Intro (no VO) | `audio-mus-0` | 0 → 95 | 0 | 0.7 | in 20, out 10 |
| Under VO | `audio-mus-1` | 85 → 640 | 85 | 0.18 | in 10, out 10 |
| Outro | `audio-mus-0` | 630 → 900 | 630 | 0.7 | in 10, out 45 |

The key: **`trimIn` = segment start**, so the song plays continuously across segments. The overlaps (85–95, 630–640) are the crossfades.

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
