---
name: caju-audio
description: Voice-over, music, sound effects and ambience in Caju Motion projects. Covers file preparation, loudness targets, audio track layout and roles, fades, automatic ducking and loudness normalization, volume keyframes, beat detection and syncing visuals to narration. Use whenever a Caju video has any sound, TTS/locução, soundtrack, SFX, or A/V sync problems.
version: 0.2.0
---

# Caju audio

## The model (what the document supports today)
- Audio is an asset (`kind: "audio"`) plus an **audio clip** on a track with `kind: "audio"`.
  - Audio clips are only allowed on audio tracks, and audio tracks only hold audio clips. `check` enforces this.
- Clips on one track **cannot overlap**. Overlapping sounds (music under voice, two SFX at once) need separate tracks.
- Per clip: `start`, `duration`, `trimIn` (frames skipped in the source), `speed`, and
  `audio: { "volume": number ≥ 0, "fadeIn": frames, "fadeOut": frames, "pan": -1..1 }`.
- **Volume over time:** keyframes on `audio.volume` (linear ramps in the export; `hold` steps). `pan` is applied.
- **Track roles** (`track.role`): `voice`, `music` or `sfx`. They drive ducking. Without a role, a track named "Locução…" counts as voice and any other audio track as music.
- **Project mix** (`settings.audio`, export only):
  - `ducking: { enabled, ratio 6, threshold 0.03, attackMs 20, releaseMs 400 }`: music tracks duck under voice tracks (sidechain compressor, about 10 dB with the defaults);
  - `loudness: { enabled, targetLufs -14, truePeakDb -1 }`: the final mix is normalized.
- Still normalize the source files (file-prep.md): the mix starts from sane levels, and loudness normalization fixes only the total.

## Track layout (one track per role, bottom → top in the timeline)
| Track id | Role | File prefix | Folder |
|---|---|---|---|
| `locucao` (or `audio-vo-0`), `role: voice` | voice-over | `vo-` | `assets/audio/vo/` |
| `audio-mus-0` (`-1` for crossfades), `role: music` | music | `mus-` | `assets/audio/music/` |
| `audio-amb-0`, `role: music` | ambience / room tone | `amb-` | `assets/audio/amb/` |
| `audio-sfx-0`, `audio-sfx-1`…, `role: sfx` | sound effects (add tracks when they overlap) | `sfx-` | `assets/audio/sfx/` |

Clip ids start with the same prefix (`vo-03`, `sfx-whoosh-2`). `p.audioClip()` in `video.ts` groups tracks by that prefix and sets the role automatically. `caju beats` gives the music's beat grid for cutting on the beat (caju-music-to-video).

## Rules
- [file-prep.md](file-prep.md): formats, sample rate, loudness normalization commands, trimming silence, measuring durations.
- [mixing.md](mixing.md): volume targets, fades, automatic ducking and loudness (`settings.audio`), volume keyframes, crossfades, SFX timing.
- [voiceover-timing.md](voiceover-timing.md): driving the scene lengths from narration, word timestamps for captions, generating the voice-over (`caju tts`, VoiceStudio by default) and captioning recorded speech (`caju transcribe`).

## Quick checklist before delivering
1. Every audio asset has `meta.durationSec`, and no clip plays past it: `trimIn + duration*speed <= durationSec*fps`.
2. VO is intelligible: music is ducked under it and SFX don't mask words.
3. Every clip that starts or ends mid-sound has a fade of at least 2–3 frames (no clicks).
4. Nothing important lands in the last 0.5 s of the video. Players cut the tail.
