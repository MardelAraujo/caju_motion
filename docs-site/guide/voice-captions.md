---
title: Voice-over and captions
description: Generate narration with text-to-speech (VoiceStudio, local and free, by default; OpenAI, ElevenLabs or a placeholder), transcribe recorded speech, get word timings, and add captions as editable text clips - from the CLI, from SRT/VTT files, or in video.ts.
---

# Voice-over and captions

`@caju-motion/voice` turns a script into a voice-over file plus the time of each word, and turns those times into captions. Captions are ordinary text clips on a "Legendas" track, so you can restyle or fix them in the Studio.

## From the CLI

```bash
# real voice, local and free, with VoiceStudio open (the default provider)
npx caju tts meu-video --text "Every video starts with an idea. Caju turns code into video." --language en
npx caju voices                                     # engines and voice profiles available
npx caju tts meu-video --script roteiro.txt --model omnivoice --voice <profile> --seed 7 --language en

# free placeholder voice (a soft tone + estimated timings), without VoiceStudio
npx caju tts meu-video --text "Every video starts with an idea." --provider placeholder

# paid cloud voices
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
| `voicestudio` (default) | — | exact (VoiceStudio transcribes the generated audio locally with WhisperX and aligns it to your script) | free, runs on your machine; `--model <engine>` (`omnivoice` default, `cosyvoice`, `voxcpm2`, `kittentts`…), `--voice <profile id or name>`, `--seed <n>`; up to 4096 characters per request |
| `placeholder` | — | estimated | free; a tone with the length of the speech (~14 characters/s) |
| `openai` | `OPENAI_API_KEY` | exact (the audio is transcribed with Whisper word timestamps and aligned to your script) | `--voice alloy\|nova\|…`, `--model gpt-4o-mini-tts`; one extra transcription call |
| `elevenlabs` | `ELEVENLABS_API_KEY` | exact (character alignment from `/with-timestamps`) | `--voice <voice_id>`, `--model eleven_multilingual_v2` |

### VoiceStudio (local and free)

[VoiceStudio](https://github.com/debpalash/VoiceStudio) is a free, open-source voice studio (text to speech, voice cloning, voice design, transcription) that runs on your computer, with an OpenAI-compatible API on port 3900. Caju only talks to it over HTTP; install and open it separately:

| System | Install |
|---|---|
| Windows | `irm https://voicestudio.sh/install \| iex` in PowerShell, or the `.exe` from the project's Releases |
| macOS / Linux | the installer from the project's README |
| Docker | `ghcr.io/debpalash/voicestudio` |

A GPU (NVIDIA CUDA or Apple MPS) is recommended; on CPU it works, just slower. `caju doctor` shows whether it is reachable, with its engines and voice profiles, and `caju voices` lists them. Voice profiles (`--voice`) are created, cloned or designed in the VoiceStudio app; without `--voice` the engine's default voice is used. `--seed` makes the same line come out the same when generated again.

- `VOICESTUDIO_URL`: the address (default `http://127.0.0.1:3900`).
- `VOICESTUDIO_API_KEY`: only when the server is not on your machine.
- Scripts longer than 4096 characters: split them into several `--name` (one per scene).
- Language quality depends on the engine (VoiceStudio lists `pt`, with no separate pt-BR). Listen to a short sample, choose the engine and voice profile, then fix them with `--seed`.

If VoiceStudio is closed, `caju tts` stops with a message explaining how to open it or to use `--provider placeholder|openai|elevenlabs`. It never falls back to a paid provider on its own.

### API keys (OpenAI, ElevenLabs)

Put the keys in a `.env` file in the folder where you run `caju` (`OPENAI_API_KEY=sk-...`, one per line); the CLI reads it on every command, a variable set in the terminal takes priority, and `caju doctor` shows which providers are configured without printing the key. Projects created by `create-caju` already git-ignore `.env`. The API keys are yours, and so are the costs. Caju only calls the provider when you run `caju tts` or `caju transcribe`, never during `caju build`, `check` or `render`.

### Transcribing recorded speech

For a talking head, an interview or a voice-over you recorded, `caju transcribe` gets the captions from the speech itself:

```bash
npx caju transcribe meu-video --from assets/video/talk.mp4 --language en             # writes the files
npx caju transcribe meu-video --from assets/video/talk.mp4 --language en --captions  # and adds the caption clips
```

It extracts the speech with FFmpeg and transcribes it (`--provider voicestudio`, the default, local and free, or `openai`, paid, with `OPENAI_API_KEY`) into `assets/data/<name>.words.json` and `assets/data/<name>.srt` (`--name`, default the file name). The same file + provider + language reuses the result; `--force` transcribes again. `--captions` adds one text clip per line on the "Legendas" track (`--offset <s>` if the media does not start at 0). In a project with `video.ts` it only writes the files: read them with `readCaptions` (below).

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
import { voiceover, voiceStudioTts, addVoiceover, addCaptions } from '@caju-motion/voice';

const vo = await voiceover({ projectDir, name: 'vo-01', text, provider: voiceStudioTts({ engine: 'omnivoice', seed: 7 }) });
project = addCaptions(addVoiceover(project, vo), vo.cues);
```

| Export | |
|---|---|
| `voiceover({ projectDir, name, text, provider, voice?, speed?, instructions?, language?, force? })` | writes the audio, `words.json` and `.srt`; returns `{ audioSrc, durationSec, words, cues, timed, cached }` |
| `voiceStudioTts({ engine?, voice?, seed?, baseUrl?, apiKey? })`, `openAiTts(opts)`, `elevenLabsTts(opts)`, `placeholderTts()` | providers; write your own by implementing `{ id, synthesize(req) }` |
| `providerByName(name, { voice?, model?, seed? })`, `DEFAULT_PROVIDER` | provider by its CLI name (`'voicestudio'` is the default) |
| `transcription({ projectDir, name, file, provider, language?, force? })` | transcribes an audio/video file into `words.json` + `.srt`; returns `{ wordsSrc, srtSrc, durationSec, words, cues, text, cached }` |
| `voiceStudioStt(opts)`, `openAiStt(opts)`, `sttByName(name)` | transcription providers (`{ id, transcribe(req) }`) |
| `voiceStudioVoices()`, `voiceStudioUrl()` | VoiceStudio engines and voice profiles; the address in use |
| `wordsToCues(words, { maxChars, maxDurationSec, maxGapSec })` | groups words into caption lines (breaks at sentence ends, pauses, length) |
| `estimateWords(text, durationSec)`, `alignScript(script, timedWords)` | timings when the provider gives none; script text with transcription timings |
| `parseSubtitles(srtOrVtt)`, `toSrt(cues)`, `toVtt(cues)`, `readCaptions(file)` | subtitle files |
| `addVoiceover(project, vo, opts)`, `addCaptions(project, cues, opts)` | edit a `project.json` (returns a new object) |
