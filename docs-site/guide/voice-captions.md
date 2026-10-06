---
title: Voice-over and captions
description: Generate narration with text-to-speech (OpenAI, ElevenLabs or a free placeholder), get word timings, and add captions as editable text clips - from the CLI, from SRT/VTT files, or in video.ts.
---

# Voice-over and captions

`@caju-motion/voice` turns a script into a voice-over file plus the time of each word, and turns those times into captions. Captions are ordinary text clips on a "Legendas" track, so you can restyle or fix them in the Studio.

## From the CLI

```bash
# free placeholder voice (a soft tone + estimated timings) to lay out the video first
npx caju tts meu-video --text "Every video starts with an idea. Caju turns code into video."

# the real voice, once the script is final
OPENAI_API_KEY=sk-... npx caju tts meu-video --script roteiro.txt --provider openai --voice nova --language en
ELEVENLABS_API_KEY=... npx caju tts meu-video --script roteiro.txt --provider elevenlabs --voice <voice_id>
```

`caju tts` writes into the project:

| File | Content |
|---|---|
| `assets/audio/vo/<name>.mp3` (or `.wav`) | the voice-over (`--name`, default `locucao`) |
| `assets/data/<name>.words.json` | the script, the provider, and the start/end of every word |
| `assets/data/<name>.srt` | the captions, for YouTube, Instagram or any editor |

It also adds the audio as a clip on a "Locução" track (`--start <s>` to begin later) and one text clip per caption line on a "Legendas" track (`--no-captions` to skip). Running it again (say, to fix a word) updates the voice-over clip without undoing your Studio edits: its track, position, volume and fades stay, and only the length follows the new audio. The captions are regenerated where the voice-over actually is. Several voice-overs (`--name vo-01`, `--name vo-02`…) that overlap in time go on separate "Locução" tracks.

**You never pay twice for the same line.** The cache key is provider + voice + speed + style + text. Re-running with the same values reuses the file. Changing the text or the voice generates a new one, and `--force` always generates.

### Providers

| `--provider` | Key | Word timings | Notes |
|---|---|---|---|
| `placeholder` (default) | — | estimated | free; a tone with the length of the speech (~14 characters/s) |
| `openai` | `OPENAI_API_KEY` | exact (the audio is transcribed with Whisper word timestamps and aligned to your script) | `--voice alloy\|nova\|…`, `--model gpt-4o-mini-tts`; one extra transcription call |
| `elevenlabs` | `ELEVENLABS_API_KEY` | exact (character alignment from `/with-timestamps`) | `--voice <voice_id>`, `--model eleven_multilingual_v2` |

Put the keys in a `.env` file in the folder where you run `caju` (`OPENAI_API_KEY=sk-...`, one per line); the CLI reads it on every command, a variable set in the terminal takes priority, and `caju doctor` shows which providers are configured without printing the key. Projects created by `create-caju` already git-ignore `.env`. The API keys are yours, and so are the costs. Caju only calls the provider when you run `caju tts`, never during `caju build`, `check` or `render`.

### Importing captions

```bash
npx caju captions meu-video --from legenda.srt            # or .vtt, or a .words.json
npx caju captions meu-video --from legenda.srt --offset 0.5
```

## In `video.ts`

Generate the voice once with the CLI (`npx caju tts meu-video --script roteiro.txt`). In a project with a `video.ts`, `caju tts` only writes the files and leaves `project.json` alone, because your code decides where the voice and the captions go. Then read the timings in your code and let them drive the scenes:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineProject } from '@caju-motion/sdk';
import { readCaptions } from '@caju-motion/voice';

export default defineProject({ id: 'meu-video', format: 'reel-9x16' }, async (p) => {
  const words = fileURLToPath(new URL('./assets/data/locucao.words.json', import.meta.url));
  const cues = await readCaptions(words);
  const { durationSec } = JSON.parse(readFileSync(words, 'utf8'));
  const end = p.sec(durationSec + 1);

  p.asset({ id: 'locucao', kind: 'audio', src: 'assets/audio/vo/locucao.mp3', meta: { durationSec } });
  p.tracks(['Legendas']);
  p.scene('reel', 'Reel', 0, end, (s) => {
    s.captions(cues, { size: 54, weight: 800, color: '#FFFFFF', bg: '#000000B3' }, { x: 540, y: 1500, track: 'Legendas' });
  });
  p.audioClip('locucao', 0, p.sec(durationSec), 'Locução');
});
```

`s.captions(cues, style, options)` adds one text clip per line. Times are in seconds from the scene start (`offsetSec` shifts them all), and lines never overlap. Use `pop: false` to turn off the pop-in.

## Programmatic API

```ts
import { voiceover, openAiTts, addVoiceover, addCaptions } from '@caju-motion/voice';

const vo = await voiceover({ projectDir, name: 'vo-01', text, provider: openAiTts({ voice: 'nova' }) });
project = addCaptions(addVoiceover(project, vo), vo.cues);
```

| Export | |
|---|---|
| `voiceover({ projectDir, name, text, provider, voice?, speed?, instructions?, language?, force? })` | writes the audio, `words.json` and `.srt`; returns `{ audioSrc, durationSec, words, cues, timed, cached }` |
| `openAiTts(opts)`, `elevenLabsTts(opts)`, `placeholderTts()` | providers; write your own by implementing `{ id, synthesize(req) }` |
| `wordsToCues(words, { maxChars, maxDurationSec, maxGapSec })` | groups words into caption lines (breaks at sentence ends, pauses, length) |
| `estimateWords(text, durationSec)`, `alignScript(script, timedWords)` | timings when the provider gives none; script text with transcription timings |
| `parseSubtitles(srtOrVtt)`, `toSrt(cues)`, `toVtt(cues)`, `readCaptions(file)` | subtitle files |
| `addVoiceover(project, vo, opts)`, `addCaptions(project, cues, opts)` | edit a `project.json` (returns a new object) |
