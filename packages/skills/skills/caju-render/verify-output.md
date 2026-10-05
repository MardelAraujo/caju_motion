# Verifying a rendered file

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate -of json out/promo.mp4
```
Check:
1. **Duration** ≈ `projectDuration / fps`, within 1 frame. The duration is `settings.duration`, or else the end of the last clip.
2. **Resolution** equals the chosen output size. **Frame rate** equals the chosen fps.
3. **Audio stream present** when the project has audio clips and audio was enabled; **48000 Hz** sample rate.
4. **Loudness** of the full mix, about −14 to −16 LUFS for social:
   ```bash
   ffmpeg -i out/promo.mp4 -af ebur128=framelog=quiet -f null - 2>&1 | grep -A2 "Integrated"
   ```
5. **A/V sync:** extract the frame at a known sound event and confirm they coincide. Reference: the `landscape-audio` fixture (flash and beep at frame 30).
6. **Visual spot-check:** extract stills at scene changes:
   ```bash
   ffmpeg -ss 00:00:03.000 -i out/promo.mp4 -frames:v 1 out/check-3s.png
   ```

Report to the user: the file path, its size, duration, resolution, and anything that failed a check.
