# Review loop: plan → build → check → look → fix → ask → render

You wrote the timeline, so you "know" what it looks like. The viewer sees it once, at full speed, on a phone. This loop makes you look at it the way they will before you ask the user anything.

## Steps
1. **Plan in chat.** Propose the storyboard in a few lines: frames, durations, the look (palette, fonts, the one transition kind), voice and music. In companion mode, or when the user asked to approve the storyboard, **stop and wait** for approval. Write `STORYBOARD.md` (caju-authoring → storyboard.md).
2. **Sketch pass (optional, for videos over ~30 s or uncertain layouts).** Build every frame static (layout only, no motion, `status: built`), then `caju snapshot <id>` and show the sheet. Fix layout before spending time on motion.
3. **Build.** `video.ts` + `caju build <id>`; add motion; set frames to `status: animated`.
4. **Check.**
   ```bash
   npm run caju -- check <id> --json
   ```
   Fix every error. For each `CAJU_*` warning (caju-authoring → motion.md, lint codes): fix it, or keep it on purpose and note why.
5. **Look.**
   ```bash
   npm run caju -- snapshot <id> --at-cuts
   ```
   Writes `projects/<id>/boards/snapshot.png` (contact sheet) and `boards/snapshot.json` (tile → frame, time, reason). **Open the PNG with your image-reading tool and actually look at it.** Default tiles: frame 0, the middle of each clip on the visual tracks, markers, the last frame; `--at-cuts` adds cut−3 / cut+6 around every boundary. For one stretch: `--frames 120,126,132`.
6. **Judge the sheet.** For each tile, in one sentence: what does a stranger see? Then:
   | Question | Typical fix |
   |---|---|
   | Is every text readable at phone size, inside the safe area? | bigger type, move up/in (caju-creative → typography) |
   | One focal point per frame? | remove or shrink competitors |
   | Does anything look like a lazy default? | caju-creative → house-style |
   | Do cuts jump (cut−3 vs cut+6 tiles)? | vector law, matched speed (caju-creative → transitions) |
   | Empty or half-built frames? | `CAJU_EMPTY_FRAME`, entrance offsets too long |
   | Does the first frame work as a thumbnail? | put the hook on frame 0–3 |
   Write each problem as `t=4.2s · where · problem → change`. Fix text first, then timing, then detail. Re-snapshot **only what changed** (`--frames`). One more pass at most, unless something is still broken.
7. **Ask once.** "Render now, or what should change?" Include: the sheet (path), the duration, what you assumed, and anything you kept on purpose. Don't render before this answer unless the user asked for no stops (autonomous mode): then render and report.
8. **Render and verify:** `caju render <id>`, then verify the file (caju-render → verify-output). You can't hear the audio: say what you measured (loudness, duration) instead.
9. **After approval:** offer, in one line, to save preferences and a recipe ([preferences.md](preferences.md)).

## Small edits
For a change to one frame: rebuild, `caju check`, `caju snapshot <id> --frames <the changed frames>`, look, reply. No full loop.
