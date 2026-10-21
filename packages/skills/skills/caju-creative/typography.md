# Typography

## Fonts available in renders
| `fontFamily` | Weights | Use |
|---|---|---|
| `Plus Jakarta Sans` | 400, 500, 600, 700, 800 | default; titles at 800, body at 400–600 (the Caju brand font) |
| `Red Hat Display` | 400, 700, 800 | a more geometric/condensed alternative for titles |
| `JetBrains Mono` | 400, 500 | code, numbers in data labels. Loaded by the Studio, but not in its font menu |

Any other family falls back to `sans-serif` and changes between machines. Brand fonts: see caju-assets → fonts-and-text (render the text as SVG/PNG when the exact font is mandatory). Pair at most two families; one family with two weights is usually better.

## Sizes (relative to frame height)
`caju check` warns below ~2.2 % of the height (`CAJU_TEXT_TOO_SMALL`), and treats ≥ 4 % as "large text" for contrast.

| Role | % of height | reel 9:16 (1920) | feed 4:5 (1350) | square (1080) | 16:9 (1080) |
|---|---|---|---|---|---|
| Hero word / number | 8–14 % | 150–260 | 110–190 | 90–150 | 90–150 |
| Title | 5–8 % | 96–150 | 70–110 | 56–86 | 56–86 |
| Subtitle | 3.5–5 % | 68–96 | 48–68 | 40–54 | 40–54 |
| Body / caption | 2.6–3.5 % | 50–68 | 36–48 | 30–38 | 30–38 |
| Fine print (legal, source) | 2.2–2.6 % | 42–50 | 30–36 | 24–28 | 24–28 |

Phones show reels small: when in doubt, go one row bigger.

## Lines
- Text never wraps: break with `\n`. Width ≈ `0.55 × fontSize × characters` (Plus Jakarta Sans 800 is a bit wider: ~0.6).
- Titles: 1–2 lines, ≤ 20 characters per line on 9:16, ≤ 32 on 16:9.
- Body: ≤ 32 characters per line on 9:16, ≤ 50 on 16:9. More text than that belongs in the voice-over.
- `lineHeight` 1.05–1.15 for titles, 1.25–1.4 for body. Negative `letterSpacing` (−1 to −3) tightens large titles; never on body.

## Weight and hierarchy
- Two or three levels per frame: hero/title at 800, support at 400–600. Size and weight make the hierarchy, not color alone.
- Highlight **one** word per line with the accent color or a `background` box (`TEXT_PRESETS.highlight`: dark text on `#F6B73C`).
- Avoid all caps for more than 3 words; if used, add letter spacing +2 to +6.

## Placement
- Keep text inside the safe area with room to spare (`CAJU_UNSAFE_AREA`; insets in caju-authoring → elements.md).
- Left-aligned text (`align: "left"`, `anchorX: 0`) on a shared left edge reads faster than centered blocks for anything over one line.
- Captions on reels: around y = 1300–1450, never in the bottom 420 px.
