---
name: caju-music-to-video
description: Workflow for beat-synced Caju Motion videos from a song - caju beats for BPM, beat and downbeat times, a cut list on beats and downbeats, visuals and motion hits on the grid, then the review loop. Use when the user gives a music track and wants a music video, lyric/visualizer reel, montage, slideshow or promo cut to the beat ("no ritmo da música", "cortes na batida").
version: 0.2.0
---

# Music → beat-synced video

The **song is the clock**: cuts on beats, layout changes on downbeats, holds on phrases. Commands assume the repo checkout (`npm run caju -- …`).

## Steps
1. **Brief** (caju-best-practices → [intent-interview.md](../caju-best-practices/intent-interview.md)): which part of the song (start/end in seconds), format, the material (photos, clips, words), and whether the music is licensed for the platform.
2. **Prepare the audio** in `projects/<id>/assets/audio/music/` (caju-audio → file-prep.md). Trim to the section you'll use first, so beat times start at 0.
3. **Detect the beats:**
   ```bash
   npm run caju -- beats projects/<id>/assets/audio/music/mus-song.mp3 --project <id>
   ```
   Writes `projects/<id>/assets/data/mus-song.beats.json`:
   ```json
   { "bpm": 122, "beats": [0.49, 0.98, 1.47], "downbeats": [0.49, 2.46], "durationSec": 31.2, "confidence": 0.82 }
   ```
   - Frame of a beat: `frame = Math.round(sec * fps)`. Compute every beat from its time, never by adding a rounded beat length repeatedly (it drifts).
   - Low `confidence` (< 0.5) or a BPM that feels doubled/halved: tell the user, try a cleaner section, or use every 2nd beat.
4. **Cut list.** Choose the grid by energy:
   | Section | Cut every | Notes |
   |---|---|---|
   | Intro / calm | 2–4 downbeats (a bar or two) | long holds, slow pushes |
   | Verse | downbeat (1 bar) | one image per bar |
   | Chorus / drop | every beat or every 2 beats | quick cuts, `flash` overlay or `pop` on the drop |
   | Outro | 2+ bars | logo and CTA held ≥ 2 s |
   Write it into `STORYBOARD.md` as frames with exact cut times (caju-authoring → [storyboard.md](../caju-authoring/storyboard.md)).
5. **Build in `video.ts`:** read the beats file and generate the scenes from it:
   ```ts
   import { readFileSync } from 'node:fs';
   const grid = JSON.parse(readFileSync(new URL('./assets/data/mus-song.beats.json', import.meta.url), 'utf8')) as { downbeats: number[]; durationSec: number };
   const cuts = [0, ...grid.downbeats.filter((s) => s > 0.2).map((s) => p.sec(s))]; // frames; the first scene starts at 0
   cuts.forEach((from, i) => {
     const to = cuts[i + 1] ?? p.sec(grid.durationSec);
     p.scene(`bar-${i + 1}`, `Compasso ${i + 1}`, from, to, (s) => { /* one image or word per bar */ }, { exit: 0 });
   });
   p.audioClip('mus-song', 0, p.sec(grid.durationSec), 'Música', { id: 'mus-song-clip', fadeOut: 30 });
   ```
   - Hits land **on** the beat frame; anticipation (a whoosh, a scale-up) starts 3–5 frames before.
   - Plain cuts are the default here; add a transition only at section changes (caju-creative → [transitions.md](../caju-creative/transitions.md)).
   - Small `pulse` loops with `dur` = frames per beat (`fps * 60 / bpm`) can make a static logo breathe with the music; use sparingly.
6. **Mix:** no voice → no ducking. Set `audio: { loudness: { enabled: true, targetLufs: -14 } }` in `defineProject`; fade the music out over the last 1–2 s.
7. **Review loop:** `caju build` → `caju check` → `caju snapshot <id> --frames <a few cut frames ±2>` and `--at-cuts` → look → fix → one question → render (caju-best-practices → [review-loop.md](../caju-best-practices/review-loop.md)). After rendering, extract a frame at a hit to confirm sync (caju-render → verify-output).

## Pitfalls
- Cutting on every beat for the whole song: exhausting. Change density with the song's sections.
- Text that changes faster than it can be read: words on a beat grid still need ≥ 1.5 s (2–4 beats) to hold.
- Beat times from an untrimmed file used with a trimmed clip: subtract the `trimIn` seconds, or re-run `caju beats` on the trimmed file.
