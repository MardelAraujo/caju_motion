---
name: caju-creative
description: Creative direction for Caju Motion videos - house style (the lazy AI defaults to avoid and what to do instead), motion principles mapped to Caju presets and easings, typography per format, palettes and contrast, and when to use which transition (cuts, poses, the vector law). Use when designing or reviewing the look and motion of any Caju video, writing a storyboard, or when the user says it looks generic, flat, busy, robotic or "like AI made it".
version: 0.2.0
---

# Caju creative direction

The rules skills (caju-authoring, caju-audio…) make a video **valid**. This skill makes it **good**: one clear idea per frame, real material, deliberate motion, readable type.

## Before you design
1. Read `BRIEF.md` and `.caju/preferences.json` (caju-best-practices). Brand colors and fonts there win over everything below.
2. Prefer **real material** over drawn imitations: the product's real screenshots (`caju capture`), the real logo, the user's footage. Draw only what has no source.
3. Run `caju catalog --query "<look>"` before inventing a named effect, transition or component.

## References
| Topic | File |
|---|---|
| Defaults that look generated, and the alternatives | [house-style.md](house-style.md) |
| Direction, easing by role, rhythm, stagger, holds, mapped to Caju presets | [motion-principles.md](motion-principles.md) |
| Sizes per format, line length, weights, the bundled fonts | [typography.md](typography.md) |
| Palettes (Caju brand included), contrast rules | [palettes.md](palettes.md) |
| Cuts vs transitions, which pose when, the vector law | [transitions.md](transitions.md) |

## The short version
- **One message per frame**, one focal point, one accent color doing a job.
- **One dominant direction of travel** for the whole film; transitions follow it.
- **Entrances decelerate, exits accelerate** (Caju mirrors exits for you), exits shorter than entrances.
- **Text lands, then holds still** long enough to read: ≥ 1.5 s, plus 0.3 s per word.
- **Vary the rhythm**: not every scene the same length, not every element the same entrance.
- **Look at it**: `caju snapshot --at-cuts`, then fix what you see (caju-best-practices → review-loop).

Ideas adapted from the HyperFrames skills by HeyGen (Apache-2.0), rewritten for Caju.
