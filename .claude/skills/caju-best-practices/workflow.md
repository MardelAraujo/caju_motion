# End-to-end workflow (today's commands)

Run everything from the repo root of the Caju/frame checkout.
- Projects live in `projects/<id>/` by default.
- Add `--dir <projectsFolder>` to `new`, `check` and `studio` to use another folder.

1. **Understand the brief.** Settle these before writing anything:
   - format: `reel-9x16`, `feed-4x5`, `square-1x1` or `landscape-16x9`;
   - duration;
   - the script or voice-over text;
   - brand colors and fonts;
   - which assets the user provides.
2. **Create the folder.**
   - Hand-written JSON or Studio-first work: `npm run caju -- new <id> --format <format>`. This creates `project.json` and `assets/`.
   - **Generator script:** skip `new`. The script creates the folder and writes `project.json`, and an empty project from `new` would only trip `guardOverwrite` (see caju-studio).
3. **Prepare assets** (caju-assets, caju-audio):
   - copy files into `projects/<id>/assets/<kind>/`;
   - convert to supported formats;
   - normalize audio loudness;
   - measure durations (ffprobe) and image sizes.
4. **Plan the timeline on paper:** a list of scenes with start/end frames. When there is a voice-over, scene lengths come from the voice-over durations (caju-audio → voiceover-timing).
5. **Write the generator** (caju-authoring): a TS script that builds the project with `ProjectBuilder` and writes `project.json`. For tiny projects, writing JSON by hand is fine.
6. **Validate:** `npm run caju -- check <id>`. Fix every error and re-run.
7. **Review:**
   - `npm run studio`, open the project, scrub through it;
   - or capture key frames (caju-render → single frames).
   - Ask the user to review in the Studio.
8. **Iterate.** If the user edited in the Studio, follow caju-studio before regenerating.
9. **Render** (caju-render) once rendering is available. Until then, deliver the project, plus stills if they are needed.

Report to the user in their language. Include: what was created, where it is, how to open it, and anything not available yet.
