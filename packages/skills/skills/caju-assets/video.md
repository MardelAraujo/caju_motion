# Video (b-roll, screen recordings)

## Convert before importing
Phones and screen recorders often produce **variable frame rate (VFR)** files, which makes seeking inaccurate. Always normalize to H.264, constant frame rate (the project fps), with a short keyframe interval:

```bash
ffmpeg -i input.mov -vf "fps=30,scale=1920:-2" -c:v libx264 -preset medium -crf 18 \
  -g 30 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart assets/video/broll-01.mp4
```
- `fps=30` must match `settings.fps`.
- `-g 30` puts a keyframe every second, so seeking is accurate.
- Scale to at most the project resolution. For vertical projects use `scale=-2:1920` or crop.
- Trim long sources first (`-ss 12 -to 27` before `-i`), so the project doesn't carry dead weight.

## Register
```json
{ "id": "broll-01", "kind": "video", "src": "assets/video/broll-01.mp4",
  "meta": { "durationSec": 15.0, "width": 1920, "height": 1080, "fps": 30, "hasAudio": true } }
```

## Clip fields that matter
- `trimIn`: frames skipped at the start of the source.
- `duration`: frames shown on the timeline. Keep `trimIn + duration * speed <= durationSec * fps`.
- `speed`: playback rate. `duration` is timeline frames, so a 2× clip of 60 source frames lasts 30.
- `audio`: `{ "volume": 0–1, "fadeIn": frames, "fadeOut": frames }` for the clip's own sound. Use `volume: 0` to mute b-roll under a voice-over.
- `props.width/height`: display size (same as images).

Video clips go on `main` or `overlay` tracks, never on `audio` tracks.
