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

## TTS cache
- Cache generated speech by a hash of `(engine, voice, rate, text)` in `.cache/tts/<hash>/`. Regenerate only when the text changes.
- Store the word timestamps next to the audio (`words.json`).
- When the user customizes a spoken name or number, regenerate only that sentence.
