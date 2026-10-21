# End-to-end workflow (today's commands)

Run everything from the repo root of the Caju/frame checkout.
- Projects live in `projects/<id>/` by default.
- Add `--dir <projectsFolder>` to `new`, `check` and `studio` to use another folder.

1. **Understand the brief.** Read `.caju/preferences.json`, then run the intent interview ([intent-interview.md](intent-interview.md)) for what is still missing, and write `projects/<id>/BRIEF.md`. At minimum settle:
   - format: `reel-9x16`, `feed-4x5`, `square-1x1` or `landscape-16x9`;
   - duration;
   - the script or voice-over text;
   - brand colors and fonts;
   - which assets the user provides.
   Then plan the frames in `STORYBOARD.md` (caju-authoring → storyboard.md) and pick a workflow skill if one fits (caju-explainer, caju-site-to-video, caju-music-to-video, caju-captioned-reel).
2. **Create the folder.**
   - Hand-written JSON or Studio-first work: `npm run caju -- new <id> --format <format>`. This creates `project.json` and `assets/`.
   - **Code-first (recommended for more than ~10 clips):** create `projects/<id>/video.ts` and skip `new`. `caju build` creates `project.json`.
3. **Prepare assets** (caju-assets, caju-audio):
   - copy files into `projects/<id>/assets/<kind>/`;
   - convert to supported formats;
   - normalize audio loudness;
   - fill durations and sizes with `npm run caju -- media <id>` (no ffprobe needed; also builds thumbnails, waveforms and, with `--proxies auto`, editing proxies).
4. **Plan the timeline on paper:** a list of scenes with start/end frames. When there is a voice-over, scene lengths come from the voice-over durations (caju-audio → voiceover-timing).
5. **Write `video.ts`** with `defineProject` (caju-authoring → generator-script.md), plus components in `components/` if needed (caju-components). Run `npm run caju -- build <id>`.
6. **Validate:** `npm run caju -- check <id>`. Fix every error and every `CAJU_*` warning you can, then re-run.
7. **Review** ([review-loop.md](review-loop.md)):
   - `npm run caju -- snapshot <id> --at-cuts`, open `projects/<id>/boards/snapshot.png` and look; fix and re-snapshot what changed;
   - ask the user to review in the Studio (`npm run studio`) or on the sheet;
   - ask once: "render now, or what should change?"
8. **Iterate.** Change `video.ts` and rebuild: Studio-made clips are kept, and edited code clips are reported as conflicts (caju-studio).
9. **Render:** `npm run caju -- render <id>` (build the Studio once first: `npm run build -w @caju-motion/studio`). Then verify the file (caju-render).
10. **Remember:** after the user approves, offer to save preferences and a recipe ([preferences.md](preferences.md)).

Report to the user in their language. Include: what was created, where it is, how to open it, and anything not available yet.
