# Timing visuals to narration

## Elastic scenes (narration drives the timeline)
1. Write the script as one VO file per scene (`vo-01`…`vo-06`).
2. Measure each file → `voFrames = Math.ceil(durationSec * fps)`.
3. Scene length = `max(minFrames, voOffset + voFrames + tailFrames)`. Typical values:
   - `voOffset` 8–15 frames: the visuals settle before the voice starts;
   - `tailFrames` 12–20: a breath after the sentence.
4. Scene `from` = previous scene's `to`. Put each VO clip at `scene.from + voOffset`.
5. Recompute everything from the measured durations whenever the VO changes. **Never hard-code frame numbers** that depend on audio length.

```ts
const fps = 30;
let t = 0;
const scenes = vo.map((v) => {
  const frames = Math.ceil(v.durationSec * fps);
  const len = Math.max(60, 10 + frames + 15);
  const s = { id: v.id, from: t, to: t + len, voAt: t + 10, voFrames: frames };
  t += len;
  return s;
});
```

## Word-level sync (captions, highlights)
- `caju tts` and `caju transcribe` write the time of each word to `assets/data/<name>.words.json`; other TTS engines and aligners (Edge TTS word boundaries, Whisper with word timestamps) return it too. Convert to frames: `Math.round(sec * fps) + voClipStart`.
- Show a word when it starts. Keep each caption chunk on screen for ≥ 0.6 s.
- Caption chunks: 2–5 words, at most 2 lines, inside the safe area (above the bottom inset on reels).

## Generating the voice-over (`caju tts`)
```bash
npm run caju -- voices                                                                # VoiceStudio engines and voice profiles
npm run caju -- tts <id> --script script.txt --name vo-01 --language pt               # default: VoiceStudio (local, free)
npm run caju -- tts <id> --script script.txt --name vo-01 --model omnivoice --voice <profile> --seed 7 --language pt
npm run caju -- tts <id> --text "Script here." --name vo-01 --provider placeholder    # free placeholder: tone + estimated timings
npm run caju -- tts <id> --script script.txt --name vo-01 --provider openai --voice nova --language pt   # paid
npm run caju -- tts <id> --script script.txt --name vo-01 --provider elevenlabs --voice <voice_id>       # paid
```
- Writes `assets/audio/vo/<name>.mp3|wav`, `assets/data/<name>.words.json` (exact word timings from the provider) and `assets/data/<name>.srt`; adds the audio clip on a "Locução" track (`--start <s>`) and caption text clips on a "Legendas" track (`--no-captions` to skip). Re-running keeps the user's Studio edits to the voice-over clip (track, position, volume, fades); only its length follows the new audio, and the captions follow the clip's real position.
- **Default provider: `voicestudio`**, a free, open-source app ([VoiceStudio](https://github.com/debpalash/VoiceStudio)) that runs on the user's machine (OpenAI-compatible API on port 3900). The user installs and opens it separately (Windows: `irm https://voicestudio.sh/install | iex` or the `.exe` from Releases; macOS/Linux installers; Docker `ghcr.io/debpalash/voicestudio`); a GPU (CUDA / Apple MPS) is recommended, CPU works but is slower. `caju doctor` shows whether it is reachable, with its engines and voice profiles. `VOICESTUDIO_URL` changes the address (default `http://127.0.0.1:3900`); `VOICESTUDIO_API_KEY` is only needed when the server is on another machine.
  - `--model <engine>` picks the engine (`omnivoice` default; `cosyvoice`, `voxcpm2`, `kittentts`…), `--voice <profile id or name>` a voice profile created, cloned or designed in the VoiceStudio app (default: the engine's default voice), `--seed <n>` makes the speech repeatable. Word timings are exact: VoiceStudio transcribes the generated audio locally (WhisperX) and aligns it to the script.
  - At most 4096 characters per request: split longer scripts into several `--name` (one per scene is the norm anyway).
  - pt-BR quality depends on the engine (VoiceStudio lists `pt`, no separate pt-BR). Generate a short sample, let the user listen, choose the engine/voice profile, then fix it with `--seed`.
  - If VoiceStudio is closed, the command fails with how to open it. **Never switch to a paid provider on your own**: tell the user, and use `--provider placeholder` (free: tone + estimated timings) to keep laying out the video.
- **OpenAI and ElevenLabs cost the user money and need their key** (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`): ask before using them. Keys go in a `.env` file in the folder where `caju` runs (already git-ignored by `create-caju`); `caju doctor` shows which providers are configured. Never print, log or commit a key.
- Cached by `(provider, voice, speed, instructions, text)`: re-running with the same values does not call the provider again. Change one sentence → use one `--name` per sentence (`vo-01`…`vo-06`) so only that file is regenerated. `--force` always regenerates.
- In a project with `video.ts`, `caju tts` only writes the files (never edits `project.json`, which would duplicate clips on the next build); wire them in code (below). `--files-only` does the same anywhere.
- Import existing captions: `npm run caju -- captions <id> --from file.srt|.vtt|.words.json [--offset s]`.

## Captions for recorded speech (`caju transcribe`)
For talking heads, interviews or a voice-over the user recorded:
```bash
npm run caju -- transcribe <id> --from assets/video/talk.mp4 --language pt --captions
```
- Extracts the speech with FFmpeg and transcribes it (VoiceStudio by default, local and free; `--provider openai` is paid: ask first) → `assets/data/<name>.words.json` + `.srt` (`--name`, default = the file name). Cached by file hash + provider + language; `--force` redoes it.
- `--captions` adds the caption clips on the "Legendas" track (`--offset <s>` = where the media starts on the timeline). In a project with `video.ts` it only writes the files: use `readCaptions` (below).

## Captions in `video.ts`
```ts
import { fileURLToPath } from 'node:url';
import { readCaptions } from '@caju-motion/voice';
const cues = await readCaptions(fileURLToPath(new URL('./assets/data/vo-01.words.json', import.meta.url)));
s.captions(cues, { size: 54, weight: 800, color: '#FFFFFF', bg: '#000000B3' }, { x: 540, y: 1500, track: 'Legendas', offsetSec: 0.3 });
```
Times are seconds from the scene start (`offsetSec` = where the VO clip starts inside the scene). Lines never overlap.
