---
name: caju-audio
description: Voice-over, music, sound effects and ambience in Caju Motion projects. Covers file preparation, loudness targets, audio track layout, fades, ducking and syncing visuals to narration. Use whenever a Caju video has any sound, TTS/locução, soundtrack, SFX, or A/V sync problems.
version: 0.1.0
---

# Caju audio

## The model (what the document supports today)
- Audio is an asset (`kind: "audio"`) plus an **audio clip** on a track with `kind: "audio"`.
  - Audio clips are only allowed on audio tracks, and audio tracks only hold audio clips. `check` enforces this.
- Clips on one track **cannot overlap**. Overlapping sounds (music under voice, two SFX at once) need separate tracks.
- Per clip: `start`, `duration`, `trimIn` (frames skipped in the source), `speed`, and
  `audio: { "volume": number ≥ 0, "fadeIn": frames, "fadeOut": frames, "pan": -1..1 }`.
- **Volume is static per clip, plus linear fades.** Volume keyframes are not applied, and `pan` is stored but not applied yet. For volume changes over time, split the clip (see ducking).
- No automatic loudness normalization: **normalize the files before importing.**

## Track layout (one track per role, bottom → top in the timeline)
| Track id | Role | File prefix | Folder |
|---|---|---|---|
| `locucao` (or `audio-vo-0`) | voice-over | `vo-` | `assets/audio/vo/` |
| `audio-mus-0` (`-1` for crossfades) | music | `mus-` | `assets/audio/music/` |
| `audio-amb-0` | ambience / room tone | `amb-` | `assets/audio/amb/` |
| `audio-sfx-0`, `audio-sfx-1`… | sound effects (add tracks when they overlap) | `sfx-` | `assets/audio/sfx/` |

Clip ids start with the same prefix (`vo-03`, `sfx-whoosh-2`). `ProjectBuilder.audioClip()` groups tracks by that prefix automatically.

## Rules
- [file-prep.md](file-prep.md): formats, sample rate, loudness normalization commands, trimming silence, measuring durations.
- [mixing.md](mixing.md): volume targets, fades, ducking without automation, crossfades, SFX timing.
- [voiceover-timing.md](voiceover-timing.md): driving the scene lengths from narration, word timestamps for captions, TTS caching.

## Quick checklist before delivering
1. Every audio asset has `meta.durationSec`, and no clip plays past it: `trimIn + duration*speed <= durationSec*fps`.
2. VO is intelligible: music is ducked under it and SFX don't mask words.
3. Every clip that starts or ends mid-sound has a fade of at least 2–3 frames (no clicks).
4. Nothing important lands in the last 0.5 s of the video. Players cut the tail.
