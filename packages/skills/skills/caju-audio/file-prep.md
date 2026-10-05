# Preparing audio files

## Formats
- **48 kHz**, stereo (VO may be mono).
- VO/SFX: **WAV** (pcm_s16le) when editing, or **MP3 192 kbps+**. Music: MP3 256 kbps / AAC.
- One file per VO sentence or scene. That keeps re-timing easy and lets the Studio move each one.

## Loudness targets (integrated LUFS, true peak −1.5 dBTP)
| Role | Normalize file to | Clip `volume` under VO |
|---|---|---|
| Voice-over | **−16 LUFS** | 1.0 |
| Music bed | −16 LUFS | 0.12–0.25 under VO, 0.5–0.8 alone |
| SFX | −18 LUFS | 0.3–0.7 |
| Ambience | −24 LUFS | 0.2–0.5 |

Normalize with ffmpeg's `loudnorm` (two-pass is better, single pass is acceptable):
```bash
ffmpeg -i raw/vo-03.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a pcm_s16le assets/audio/vo/vo-03.wav
```

## Trim silence at the edges (VO)
```bash
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" out.wav
```
Then leave ~3 frames of natural breath by starting the clip 3 frames early.

## Measure durations (fill `meta.durationSec`)
```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/vo/vo-03.wav
```
Frames on the timeline: `Math.ceil(durationSec * fps)`. Use ceil for audio so the tail is never cut.

MP3 files report a slightly longer duration than the real audio (encoder padding, about 25–50 ms). Prefer WAV for VO, or subtract one frame when you need a tight cut.

## Placeholders (when the user has no audio yet)
FFmpeg can synthesize stand-ins with the right length and loudness:
```bash
# VO-like placeholder (3.4 s): modulated tone, normalized like real VO
ffmpeg -f lavfi -i "sine=frequency=220:duration=3.4" -af "tremolo=f=4:d=0.7,loudnorm=I=-16:TP=-1.5" -ar 48000 assets/audio/vo/vo-01.wav
# Music-bed placeholder (16 s): soft chord with fades
ffmpeg -f lavfi -i "aevalsrc=0.2*sin(2*PI*220*t)+0.15*sin(2*PI*277*t)+0.15*sin(2*PI*330*t):d=16:s=48000" -af "afade=t=in:d=1,areverse,afade=t=in:d=2,areverse" assets/audio/music/mus-bed.mp3
# Click / beep SFX
ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.15" -af "afade=t=out:st=0.1:d=0.05" -ar 48000 assets/audio/sfx/sfx-click.wav
```
- For speech-like placeholders, the OS text-to-speech works too: on Windows, PowerShell `System.Speech`; on macOS, `say -o vo.aiff "texto"`. Then convert to 48 kHz WAV and normalize.
- Always tell the user which files are placeholders, and replace them with real, licensed audio before the final render.
