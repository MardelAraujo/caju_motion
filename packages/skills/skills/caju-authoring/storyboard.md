# Storyboard: `STORYBOARD.md`

The storyboard is the **plan layer** of a video: an ordered list of frames (key moments), in one Markdown file at `projects/<id>/STORYBOARD.md`, next to `BRIEF.md` (caju-best-practices → intent-interview). It is written before `video.ts`, approved by the user (when they asked to approve it), and kept in sync while building. The next session reads it to resume the work.

## File shape

```markdown
---
format: reel-9x16            # FormatId
durationSec: 30              # what the user asked for; advisory, compare with the real cut
message: "Caju turns a script into a finished reel in minutes"
audience: social media managers at small agencies
arc: Hook → Problem → Demo → Proof → CTA
voice: voicestudio omnivoice, profile "ana", seed 7   # or "none"
mode: companion              # companion | autonomous
---

## Frame 1 — Hook
- status: animated
- duration: 3s
- voiceover: "Your next reel is already written."
- on_screen: "Already written." (title, 2 lines max)
- visuals: dark ground #171512, big type, one accent word in #F6B73C
- assets: —
- transition_in: cut
- motion: title rises 40 px over 18 f expoOut, accent word pops at +6 f; holds still after landing
- sound: bed enters on the first downbeat

The thesis in one breath. Everything after pays it off.

## Frame 2 — The problem
- status: built
- duration: 5s
- voiceover: "But turning it into video takes a whole afternoon."
- on_screen: "A whole afternoon"
- visuals: real screenshot of the timeline (assets/capture/page.png), slow 1 → 1.06 scale
- assets: assets/capture/page.png
- transition_in: slide from right (vector law: frame 1 exits left)
- motion: screenshot slides in 14 f expoOut; label wipes in from left at +8 f
```

## Frontmatter keys
| Key | Meaning |
|---|---|
| `format` | `reel-9x16`, `feed-4x5`, `square-1x1` or `landscape-16x9` |
| `durationSec` | target length in seconds (advisory) |
| `message` | the one sentence the viewer must leave with |
| `audience` | who watches, where |
| `arc` | the beats, e.g. `Hook → Problem → Solution → Proof → CTA` |
| `voice` | provider + engine/profile + seed, or `none` |
| `mode` | `companion` (stop for approvals) or `autonomous` (no stops until the final question) |

Other keys (palette, fonts, music file, bpm…) are allowed: keep what the build needs.

## Frame blocks
One `## Frame N — <name>` heading per frame, metadata as `- key: value` bullets, then free notes.

| Key | Meaning |
|---|---|
| `status` | `outline` (planned) → `built` (layout exists in `video.ts`, static) → `animated` (motion done) |
| `duration` | `3s` or frames (`90f`). With a voice-over, it comes from the measured VO (caju-audio → voiceover-timing) |
| `voiceover` | the exact narration line, or `—` |
| `on_screen` | the exact text shown (short; it is not the voice-over) |
| `visuals` | what is drawn: ground, layout, components, colors |
| `assets` | files used (`assets/...`), or `—` for drawn-only frames |
| `transition_in` | `cut`, or a pose (`slide from right`, `fade`, `wipe`…). Build it per caju-authoring → motion.md |
| `motion` | the moves inside the frame, with frames and easings |
| `sound` | optional: bed, SFX on visible actions, silence |

## Rules
- **Frame N ↔ scene id.** Use the same order and a stable scene id in `video.ts` (`p.scene('hook', 'Frame 1 — Hook', …)`), so a request like "change frame 3" maps to one scene.
- **Revise only what the user names.** "Frame 2 is too slow" changes frame 2's block and scene; other frames keep their text and status.
- Update `status` as you go; a frame goes back to `built` when its layout changes.
- The storyboard is a plan, not the truth: the document (`project.json`) still is. If the user edited the Studio, read the project before trusting the storyboard (caju-studio).
- Keep it short: 5–12 frames for 15–60 s. More frames than seconds/3 usually means the video is too busy.
