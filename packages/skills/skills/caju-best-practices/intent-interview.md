# Intent interview → `BRIEF.md`

For a **fresh request** ("make a video about…"). Goal: settle what matters in a few short questions, write it down, and never ask again what is already known.

## 0. Read before asking
1. `.caju/preferences.json` ([preferences.md](preferences.md)): brand colors, fonts, voice, caption style, pacing, default format.
2. A recipe the user names ("same as the launch reel") in `.caju/recipes/<name>.json`.
3. Whatever the request and attached files already say (a script, a URL, a logo, a song).

Anything known from these is **not asked**: state it as an assumption instead ("I'll use your saved voice, `ana`, seed 7").

## 1. Must-have fields
Ask only the fields still missing, **one question per field**, each with a recommended option the user can accept with "ok". Group them in one message when the chat allows (a numbered list), so the user answers once.

| Field | Question (adapt to the user's language) | Recommended default |
|---|---|---|
| Audience | Who watches it, and where? | inferred from the platform |
| Message | What should the viewer remember, in one sentence? | draft one from the request and ask to confirm |
| Format / platform | Reel/TikTok 9:16, feed 4:5, square 1:1 or YouTube 16:9? | `reel-9x16` for social, `landscape-16x9` for site/YouTube |
| Duration | How long? | 15–30 s social, 45–90 s explainer |
| Tone | Energetic, calm, premium, playful, serious? | from the brand / audience |
| Brand & assets | Logo, colors, fonts, screenshots, footage? | Caju dark palette, Plus Jakarta Sans (caju-creative) |
| Voice | Narration? Generated (VoiceStudio, free/local) or a recording? | VoiceStudio if there is a script; none for a 10 s promo |
| Captions | Burned-in captions? Style? | yes on 9:16 with voice |
| Music | A track? Ducked under the voice? | yes, ducked, if the user provides a licensed file |
| Must-haves | Anything that must appear (URL, price, legal line, CTA)? | — |

Never offer paid voice providers (OpenAI, ElevenLabs) as the default: ask first, they cost the user money (caju-audio).

## 2. Two separate questions (always ask, even if everything else is known)
1. **Approve the storyboard first?** "Do you want to approve the storyboard before I build (yes/no)?" Default: yes for videos over 20 s.
2. **Mode:** "Should I work **autonomously** (build, check and only ask at the end) or as a **companion** (stop after the plan and after the first build)?" Default: companion.

Record both in `BRIEF.md` and in the storyboard frontmatter (`mode`).

## 3. Write `projects/<id>/BRIEF.md`
Split what the user said from what you inferred, so either of you can correct it later.

```markdown
# Brief: <id>

## User said
- Audience: small agency social media managers
- Message: "Caju turns a script into a finished reel in minutes"
- Format: reel-9x16, 30 s
- Must-haves: URL caju.app at the end

## Inferred (confirm or correct)
- Tone: energetic but clean (from "launch")
- Brand: Caju dark palette, Plus Jakarta Sans 800/500 (from preferences.json)
- Voice: VoiceStudio omnivoice, profile "ana", seed 7 (from preferences.json)
- Captions: yes, 2–4 words, yellow active word (preferences.json)
- Music: none provided → ask before the final render

## Process
- Storyboard approval: yes
- Mode: companion
```

## 4. Route
- Then write `STORYBOARD.md` (caju-authoring → storyboard.md) and follow the matching workflow skill:
  - topic or script → [caju-explainer](../caju-explainer/SKILL.md);
  - a URL / a product site → [caju-site-to-video](../caju-site-to-video/SKILL.md);
  - a song / beat-driven → [caju-music-to-video](../caju-music-to-video/SKILL.md);
  - recorded speech / talking head → [caju-captioned-reel](../caju-captioned-reel/SKILL.md);
  - none of these → the generic workflow ([workflow.md](workflow.md)).
- Creative choices follow [caju-creative](../caju-creative/SKILL.md). The build ends with the review loop ([review-loop.md](review-loop.md)).
