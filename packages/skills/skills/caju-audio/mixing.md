# Mixing in the document

## Fades (frames, linear)
- VO: `fadeIn` 0–2, `fadeOut` 2–4.
- Music: `fadeIn` 15–30 at the start, `fadeOut` 30–60 at the end of the video.
- SFX: `fadeOut` 2–6 when the clip is cut before the sound ends naturally.

## Ducking (music under voice) without volume automation
Volume is static per clip, so **split the music into segments** and give each one its own volume, using two music tracks so segments can overlap for a smooth crossfade:

| Segment | Track | `start`→end (frames) | `trimIn` | volume | fades |
|---|---|---|---|---|---|
| Intro (no VO) | `audio-mus-0` | 0 → 95 | 0 | 0.7 | in 20, out 10 |
| Under VO | `audio-mus-1` | 85 → 640 | 85 | 0.18 | in 10, out 10 |
| Outro | `audio-mus-0` | 630 → 900 | 630 | 0.7 | in 10, out 45 |

The key: **`trimIn` = segment `start` (minus the music clip's own start)**, so the song keeps playing continuously across segments. The overlaps (85–95, 630–640) are the crossfades.

## SFX timing
- Hit the frame where the visual event happens, e.g. a whoosh *starts* 3–5 frames before the motion peaks and a pop lands exactly on the scale peak.
- Two SFX that overlap need two `audio-sfx-N` tracks.
- Don't stack more than 2 SFX at once under VO.

## A/V sync check
- Audio and video share the same frame clock. If a sound feels late, move the clip a few frames earlier. Don't change `trimIn` unless the file itself has leading silence.
- The repo fixture `fixtures/projects/landscape-audio` (white flash + beep at frame 30) is the reference sync test.
