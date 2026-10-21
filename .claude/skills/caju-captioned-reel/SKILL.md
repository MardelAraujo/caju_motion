---
name: caju-captioned-reel
description: Workflow for captioned reels from recorded speech in Caju Motion - talking-head video or a recorded voice-over, caju transcribe --captions for word timings, caption styling (chunks, one-word pops, karaoke-style active word with a component), safe areas per platform, then the review loop. Use when the user has a video of someone talking, a podcast clip, an interview or their own narration and wants burned-in captions / legendas / subtitles on a reel.
version: 0.2.0
---

# Recorded speech → captioned reel

The **recording is the clock**: the video (or voice file) plays as is, and captions follow its word timings. Commands assume the repo checkout (`npm run caju -- …`).

## Steps
1. **Brief** (caju-best-practices → [intent-interview.md](../caju-best-practices/intent-interview.md)): usually `reel-9x16`; ask for the caption style (or use `.caju/preferences.json` → `captions`) and which part of the recording to use.
2. **Prepare the media** (caju-assets → video.md): H.264 CFR, trimmed to the part you'll use; register it (`caju media <id>` fills `meta`). A 16:9 talking head on a 9:16 reel: scale it to cover the height and center the face, or place it in the top half with captions below.
3. **Transcribe:**
   ```bash
   npm run caju -- transcribe <id> --from assets/video/talk.mp4 --language pt --captions [--offset <s>]
   ```
   - Writes `assets/data/talk.words.json` + `talk.srt` (VoiceStudio by default, local and free; `--provider openai` is paid: ask first).
   - `--captions` adds one text clip per caption line on the "Legendas" track; `--offset` = where the media starts on the timeline. In a `video.ts` project it only writes the files: wire them with `readCaptions` (below).
   - Read the `.srt` and fix misheard names and brand words with the user before styling (edit `words.json` text, keep the times).
4. **Pick a caption style:**
   | Style | How | When |
   |---|---|---|
   | Chunks (2–5 words) | `s.captions(cues, style, el)` with `readCaptions(file)` | default, calm talks |
   | One word at a time, popping | `readCaptions(file, { maxChars: 10 })` + `s.captions(…, { pop: true })` | energetic short-form |
   | Karaoke (active word highlighted) | the `KaraokeCaption` component below, one clip per cue | the most legible for fast speech |
   Style per caju-creative → [typography.md](../caju-creative/typography.md): 800 weight, 54–72 px on 9:16, off-white with a dark box (`bg: '#000000B3'`) or dark text on the accent; one highlight color.
5. **Safe area.** Reels: keep captions between y ≈ 1250 and 1450 (bottom 420 px are covered by the app UI, top 250 px by the header). `caju check` flags `CAJU_UNSAFE_AREA`, `CAJU_TEXT_TOO_SMALL` and `CAJU_LOW_CONTRAST`. Don't cover the speaker's mouth/face.
6. **Extras** (optional, from the storyboard): title card in the first 1–2 s (the hook as text), lower third with the speaker's name (`LowerThird` component if present: `caju catalog --kind component`), b-roll or screenshots over key sentences on an overlay track, a `colorOverlay`/`vignette` effect clip for a consistent grade. Music: only if asked, ducked automatically (`audio: { ducking: { enabled: true } }`). The speech inside a video clip only drives the ducking when the **video's track** has `role: "voice"`; otherwise extract the speech to a `vo-` audio clip and mute the video (caju-audio → mixing).
7. **Review loop:** `caju build` → `caju check` → `caju snapshot <id> --at-cuts` → look (are captions readable and clear of the face and UI?) → fix → one question → render (caju-best-practices → [review-loop.md](../caju-best-practices/review-loop.md)).

## Captions in `video.ts`
```ts
import { fileURLToPath } from 'node:url';
import { readCaptions } from '@caju-motion/voice';

const cues = await readCaptions(fileURLToPath(new URL('./assets/data/talk.words.json', import.meta.url)));
// chunk style
s.captions(cues, { size: 64, weight: 800, color: '#FFF8E9', bg: '#000000B3' }, { x: 540, y: 1380, track: 'Legendas' });
// karaoke style: one component clip per cue, word times relative to the cue
cues.forEach((c, i) =>
  s.component('KaraokeCaption', {
    words: (c.words ?? []).map((w) => ({ text: w.text, start: w.start - c.start, end: w.end - c.start })),
  }, { id: `karaoke-${i + 1}`, y: 1380, height: 240, at: [p.sec(c.start), p.sec(c.end)], track: 'Legendas', exit: false }),
);
```
Times in cues are seconds from the start of the media; add the media's start in the scene when it isn't 0.

## Karaoke component (`components/KaraokeCaption.tsx`)
A deterministic component (caju-components): the active word is computed from the frame, nothing else.
```tsx caju-check
import { useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).default([]).describe('Palavras (s desde o início do clipe)'),
  size: z.number().min(24).max(200).default(64).describe('Tamanho'),
  color: z.string().describe('color').default('#FFF8E9'),
  activeColor: z.string().describe('color').default('#F6B73C'),
  box: z.string().describe('color').default('#000000B3'),
});
type Props = z.infer<typeof schema>;

function KaraokeCaption({ words, size, color, activeColor, box }: Props) {
  const t = useFrame() / useVideoConfig().fps;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: box, borderRadius: size * 0.3, padding: `${size * 0.15}px ${size * 0.35}px`, textAlign: 'center',
                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: size, lineHeight: 1.15 }}>
        {words.map((w, i) => {
          const active = t >= w.start && t < w.end;
          return (
            <span key={i} style={{ display: 'inline-block', margin: `0 ${size * 0.12}px`, color: active ? activeColor : color,
                                   transform: `scale(${active ? 1.08 : 1})` }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default defineComponent({
  name: 'KaraokeCaption',
  label: 'Legenda karaokê',
  description: 'Legenda com a palavra falada em destaque.',
  schema,
  width: 960,
  height: 240,
  durationInFrames: 90,
  component: KaraokeCaption,
});
```

## Pitfalls
- Captions with more than 2 lines, or changing faster than ~0.6 s per chunk.
- Fixing transcript errors by retiming: edit the text, keep the times.
- A caption track that overlaps itself: `s.captions` never overlaps lines; hand-made clips must not either (one track, no overlap).
