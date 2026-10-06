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
- TTS engines and aligners (Edge TTS word boundaries, Whisper with word timestamps) return the time of each word. Convert to frames: `Math.round(sec * fps) + voClipStart`.
- Show a word when it starts. Keep each caption chunk on screen for ≥ 0.6 s.
- Caption chunks: 2–5 words, at most 2 lines, inside the safe area (above the bottom inset on reels).

## Generating the voice-over (`caju tts`)
```bash
npm run caju -- tts <id> --text "Script here." --name vo-01                          # free placeholder: tone + estimated timings
npm run caju -- tts <id> --script script.txt --name vo-01 --provider openai --voice nova --language pt
npm run caju -- tts <id> --script script.txt --name vo-01 --provider elevenlabs --voice <voice_id>
```
- Writes `assets/audio/vo/<name>.mp3|wav`, `assets/data/<name>.words.json` (exact word timings from the provider) and `assets/data/<name>.srt`; adds the audio clip on a "Locução" track (`--start <s>`) and caption text clips on a "Legendas" track (`--no-captions` to skip). Re-running keeps the user's Studio edits to the voice-over clip (track, position, volume, fades); only its length follows the new audio, and the captions follow the clip's real position.
- **Real voices cost the user money and need their key** (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`). Lay the video out with the default `placeholder` provider, and ask before switching to a paid one.
- Cached by `(provider, voice, speed, instructions, text)`: re-running with the same values does not call the provider again. Change one sentence → use one `--name` per sentence (`vo-01`…`vo-06`) so only that file is regenerated. `--force` always regenerates.
- In a project with `video.ts`, `caju tts` only writes the files (never edits `project.json`, which would duplicate clips on the next build); wire them in code (below). `--files-only` does the same anywhere.
- Import existing captions: `npm run caju -- captions <id> --from file.srt|.vtt|.words.json [--offset s]`.

## Captions in `video.ts`
```ts
import { fileURLToPath } from 'node:url';
import { readCaptions } from '@caju-motion/voice';
const cues = await readCaptions(fileURLToPath(new URL('./assets/data/vo-01.words.json', import.meta.url)));
s.captions(cues, { size: 54, weight: 800, color: '#FFFFFF', bg: '#000000B3' }, { x: 540, y: 1500, track: 'Legendas', offsetSec: 0.3 });
```
Times are seconds from the scene start (`offsetSec` = where the VO clip starts inside the scene). Lines never overlap.
