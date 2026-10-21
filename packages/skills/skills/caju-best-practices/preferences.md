# Preferences and recipes (memory across videos)

Two small JSON files in the Caju folder (next to `projects/`), so the next video doesn't start from zero. They are plain files the user can read and edit; never put API keys or secrets in them.

## `.caju/preferences.json`
**Read it before asking anything** (intent-interview.md). **Update it only after the user approves** a result ("perfect", "render it"), and tell them what you saved.

```json
{
  "brand": {
    "name": "Caju",
    "colors": { "background": "#171512", "text": "#FFF8E9", "accent": "#F6B73C", "support": "#F47B35" },
    "fonts": { "heading": "Plus Jakarta Sans 800", "body": "Plus Jakarta Sans 500" },
    "logo": "assets/images/logo-caju.svg"
  },
  "format": "reel-9x16",
  "voice": { "provider": "voicestudio", "engine": "omnivoice", "profile": "ana", "seed": 7, "language": "pt", "speed": 1 },
  "captions": { "enabled": true, "wordsPerChunk": 3, "size": 64, "weight": 800, "color": "#FFFFFF", "activeColor": "#F6B73C", "background": "#000000B3", "y": 1380 },
  "pacing": "energetic",
  "music": { "ducking": true, "loudnessLufs": -14 },
  "transitions": ["slide", "cut"],
  "language": "pt-BR"
}
```
- All keys are optional; keep only what the user actually chose or approved.
- `logo` is a path relative to a project folder: copy the file into each new project's `assets/` (assets never live outside the project).
- The user's explicit request in the current chat always wins over a saved preference.

## Recipes: `.caju/recipes/<name>.json`
A recipe freezes a **successful run** so "do another one like that" ("faz outro igual") reproduces its shape with new content.

```json
{
  "name": "launch-reel",
  "createdFrom": "projects/lancamento-v2",
  "brief": { "format": "reel-9x16", "durationSec": 30, "tone": "energetic", "voice": true, "captions": true, "music": true },
  "arc": ["Hook", "Problem", "Demo", "Proof", "CTA"],
  "frames": [
    { "name": "Hook", "durationSec": 3, "visuals": "big type, one accent word", "transition_in": "cut" },
    { "name": "Problem", "durationSec": 5, "visuals": "real screenshot, slow push", "transition_in": "slide from right" },
    { "name": "Demo", "durationSec": 10, "visuals": "capture/page.png sections, wipe reveals", "transition_in": "slide from right" },
    { "name": "Proof", "durationSec": 6, "visuals": "CountUp component with the number", "transition_in": "slide from right" },
    { "name": "CTA", "durationSec": 6, "visuals": "logo + URL, held 2 s", "transition_in": "fade" }
  ],
  "components": ["CountUp"],
  "notes": "User liked the yellow active caption word and 3-frame stagger."
}
```
- Save one only after approval, and only when the user agrees ("Save this as a recipe called `launch-reel`?").
- To use one: read it, copy the brief fields into the new `BRIEF.md` (as "inferred"), and generate `STORYBOARD.md` with the same frames, new content. Ask only for the new content (topic, script, assets).
- The source project's `video.ts` is a good starting point too: copy it to the new project folder, change `id`, and replace the content.
