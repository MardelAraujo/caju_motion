# Mixing in the document

## Fades (frames, linear)
- VO: `fadeIn` 0–2, `fadeOut` 2–4.
- Music: `fadeIn` 15–30 at the start, `fadeOut` 30–60 at the end of the video.
- SFX: `fadeOut` 2–6 when the clip is cut before the sound ends naturally.

## Ducking: let the mix do it (`settings.audio`)
Turn on the project mix and keep **one continuous music clip**:
```json
"settings": { "format": "reel-9x16", "width": 1080, "height": 1920, "fps": 30,
  "audio": { "ducking": { "enabled": true }, "loudness": { "enabled": true, "targetLufs": -14 } } }
```
In `video.ts`: `defineProject({ …, audio: { ducking: { enabled: true }, loudness: { enabled: true } } }, …)`.
- Voice = tracks with `role: "voice"` (or named "Locução…"). Music = `role: "music"` or any audio track without a role. `role: "sfx"` is never ducked.
- Speech inside a **video** clip (talking head) drives the ducking only when that video's track has `role: "voice"`; other video audio is mixed but neither ducks nor is ducked.
- Defaults: `ratio 6` (≈ 10 dB under speech; 10–12 for denser music), `threshold 0.03`, `attackMs 20`, `releaseMs 400` (raise to 600–800 if the music pumps between sentences).
- Set the music clip's `volume` for the parts **without** voice (0.5–0.8); the compressor lowers it under the voice.
- `loudness` normalizes the whole export to `targetLufs` (−14 for social/YouTube, −16 for podcasts and spoken content) with true peak `truePeakDb` (−1).
- Ducking and loudness happen in the **export** only; the Studio preview plays the raw levels.

## Volume keyframes (`audio.volume`)
For a deliberate swell, a fade under a key moment or a manual duck:
```json
"keyframes": { "audio.volume": [
  { "frame": 0, "value": 0.7 }, { "frame": 85, "value": 0.7 }, { "frame": 100, "value": 0.2 },
  { "frame": 620, "value": 0.2 }, { "frame": 640, "value": 0.7 } ] }
```
- Frames are relative to the clip start. The export ramps linearly between keyframes (`easing: "hold"` steps instead); before the first and after the last, the end values hold.
- Don't combine manual volume ducks with automatic ducking on the same music: pick one.
- Split clips only when you need a different file or `trimIn`, not for volume.

## SFX timing
- Hit the frame where the visual event happens, e.g. a whoosh *starts* 3–5 frames before the motion peaks and a pop lands exactly on the scale peak.
- Two SFX that overlap need two `audio-sfx-N` tracks.
- Don't stack more than 2 SFX at once under VO.

## A/V sync check
- Audio and video share the same frame clock. If a sound feels late, move the clip a few frames earlier. Don't change `trimIn` unless the file itself has leading silence.
- The repo fixture `fixtures/projects/landscape-audio` (white flash + beep at frame 30) is the reference sync test.
