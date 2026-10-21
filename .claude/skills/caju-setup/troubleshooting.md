# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` / port 3700 busy | Studio already running, or another app on the port | Close the other Studio, or `npm run caju -- studio --port 3701` |
| `Cannot find module 'tsx'` / `@caju-motion/...` | Dependencies missing | Run `npm install` from the **repo root** (workspaces) |
| `ffmpeg` / `ffprobe` not found | Not on PATH | Windows: `winget install Gyan.FFmpeg`, then reopen the terminal. macOS: `brew install ffmpeg`. Debian/Ubuntu: `sudo apt install ffmpeg` |
| Studio blank page, console error about fonts | First load blocks on fonts (`font-display: block`) | Wait 2–3 s, or hard-reload. Check `packages/studio/public/fonts/` exists |
| `check` → `assets ausentes no disco` | `src` points to a missing file, or the case differs (Linux is case-sensitive) | Fix the path or copy the file. Keep names lowercase kebab-case |
| `check` → `se sobrepõem na trilha` | Two clips overlap in time on one track | Move one to another track or shift `start` (caju-authoring) |
| `check` → `trilha de áudio ... só aceita clipes de áudio` | Wrong track kind | Audio clips only on `kind: "audio"` tracks, visuals never there |
| `check` → `keyframe ... está fora do clipe` | Keyframe `frame >= duration` (frames are relative to clip start) | Rebase keyframes: `frame - clip.start` and keep `< duration` |
| Studio shows "o projeto mudou no disco" | A script rewrote `project.json` while the Studio had unsaved edits | Decide with the user which version wins (caju-studio) |
| Eyedropper button disabled | Browser without the EyeDropper API | Use Chrome or Edge |
| Windows paths with backslashes in `src` | Path built with `path.join` | `src` must use forward slashes: `assets/images/x.png` |
| Corporate proxy blocks `npm install` | Registry access | `npm config set proxy http://host:port` and `https-proxy` |
| `caju tts` / `caju transcribe` → `VoiceStudio não respondeu em http://127.0.0.1:3900` | The VoiceStudio app (default voice provider) is closed or not installed | Ask the user to open it (Windows: `irm https://voicestudio.sh/install \| iex`; Docker: `ghcr.io/debpalash/voicestudio`), or set `VOICESTUDIO_URL`. Meanwhile `--provider placeholder` (free). Never switch to `openai`/`elevenlabs` (paid) without asking |

When nothing matches, run `npm run check` and paste the first error to the user. Never guess silently.
