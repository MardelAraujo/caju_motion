---
name: caju-explainer
description: Workflow for a faceless explainer video in Caju Motion from a topic or a script - brief, script, generated voice-over (caju tts with VoiceStudio), word timings driving the scene timing, visuals, captions, music ducked under the voice, then the review loop. Use when the user asks for an explainer, tutorial, "vídeo explicativo", narrated reel, educational short or any voice-led video without a presenter on camera.
version: 0.2.0
---

# Faceless explainer (topic or script → narrated video)

The **voice-over is the clock**: write it first, generate it, measure it, and let its word timings place everything else. Commands assume the repo checkout (`npm run caju -- …`).

## Steps
1. **Brief.** Run the intent interview (caju-best-practices → [intent-interview.md](../caju-best-practices/intent-interview.md)) → `projects/<id>/BRIEF.md`. Typical answers: 45–90 s, `landscape-16x9` for YouTube/site or `reel-9x16` for social, voice yes, captions yes on 9:16.
2. **Script.** Write it in the user's language, one paragraph per scene, 5–8 scenes:
   - Hook (a question or a surprising fact) → 3–5 explanation scenes (one idea each) → recap → CTA.
   - ~2.3 words/s for pt-BR narration (≈ 140 wpm): 60 s ≈ 140 words. Short sentences; numbers written as the voice should say them.
   - Save as `projects/<id>/script/vo-01.txt` … `vo-06.txt` (one file per scene) and show the script to the user before generating voice when the mode is companion.
3. **Storyboard.** `STORYBOARD.md` with one frame per scene: `voiceover` = the scene's script, `on_screen` = the keyword or number only (not the sentence) (caju-authoring → [storyboard.md](../caju-authoring/storyboard.md)).
4. **Voice** (caju-audio → [voiceover-timing.md](../caju-audio/voiceover-timing.md)):
   ```bash
   npm run caju -- doctor                      # is VoiceStudio running?
   npm run caju -- voices                      # engines and voice profiles
   npm run caju -- tts <id> --script projects/<id>/script/vo-01.txt --name vo-01 --language pt --seed 7 [--model omnivoice] [--voice <profile>]
   ```
   - One `--name` per scene, so editing one sentence regenerates one file.
   - Use the voice saved in `.caju/preferences.json` when there is one. Let the user hear one sample before generating all scenes.
   - VoiceStudio closed → tell the user how to open it and lay the video out with `--provider placeholder` meanwhile. Never switch to a paid provider without asking.
   - In a `video.ts` project, `caju tts` only writes files: `assets/audio/vo/vo-0N.*`, `assets/data/vo-0N.words.json`, `.srt`.
5. **Timing from the words.** In `video.ts`, measure each VO (`measureMedia`) and compute scene windows: scene length = `max(minFrames, voOffset + voFrames + tail)` (caju-audio → voiceover-timing). Use `words.json` to land visuals on words: the number appears when the voice says it (`frame = sceneFrom + voOffset + round(word.start * fps)`).
6. **Visuals.** One idea per scene, real assets when they exist (caju-assets), components for numbers/charts (`caju catalog --kind component`; caju-components). Look, type and motion from [caju-creative](../caju-creative/SKILL.md): one transition kind between scenes, vector law, text holds.
7. **Captions** (when asked): `readCaptions('assets/data/vo-0N.words.json')` + `s.captions(cues, style, { offsetSec, track: 'Legendas' })` per scene, styled from preferences; inside the safe area. For karaoke-style highlight, see [caju-captioned-reel](../caju-captioned-reel/SKILL.md).
8. **Music** (only a licensed file the user provides): one continuous `mus-` clip at volume 0.6–0.8, and turn on the export mix in `defineProject`: `audio: { ducking: { enabled: true }, loudness: { enabled: true, targetLufs: -14 } }` (caju-audio → [mixing.md](../caju-audio/mixing.md)).
9. **Build and review:** `caju build <id>` → `caju check <id>` → `caju snapshot <id> --at-cuts` → look → fix → "render now, or what should change?" (caju-best-practices → [review-loop.md](../caju-best-practices/review-loop.md)).
10. **Render and verify** (caju-render). Offer to save the voice/caption/pacing choices and a recipe (caju-best-practices → preferences.md).

## Pitfalls
- Hard-coded scene frames: they break the moment the voice changes. Always compute from measured durations.
- On-screen text that repeats the narration word for word: show the keyword, let the voice say the sentence.
- A visual change every sentence with nothing held: let each idea breathe (caju-creative → motion-principles).
- Captions over the bottom 420 px on reels, or covering the main visual.
