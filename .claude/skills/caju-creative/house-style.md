# House style: avoid the generated look

A model's first idea is usually everyone's first idea. Before building, list which of these defaults the plan contains, and replace each one on purpose.

| Lazy default | Why it looks generated | Do instead |
|---|---|---|
| Gradient text on every title | decoration without meaning; hurts legibility | solid text; color **one** word that carries the meaning (`#F6B73C` on dark) |
| Cyan/purple neon on near-black | the stock "tech" palette | the brand's palette, or a warm ground (`#171512`) with one accent ([palettes.md](palettes.md)) |
| Pure `#000000` ground and `#FFFFFF` text | harsh, flat, smears on phones | off-black (`#171512`, `#0C0B0E`) and off-white (`#FFF8E9`, `#F3F3F0`) |
| A grid of identical cards with an icon each | slides, not film; nothing leads the eye | one hero element per frame; reveal items one by one, or vary size by importance |
| Everything centered | static, symmetrical, no direction | left-aligned blocks on a clear edge (`anchorX: 0`), asymmetric layouts, a strong diagonal |
| Emoji as bullets or icons | cheap, inconsistent rendering | shapes (`s.rect`, `ellipse`), real logos/screenshots, or no icon at all |
| "Unlock", "Elevate", "Seamless", "Game-changer", "In today's fast-paced world" | filler, says nothing | the concrete claim with a number or a noun: "3 cliques", "de roteiro a reel em 5 min" |
| Every element fades and rises the same way | robotic rhythm | 2–3 entrance families per film, chosen by role ([motion-principles.md](motion-principles.md)) |
| Floating/pulsing loops on titles | motion standing in for an idea | titles land and hold still; loops only on small secondary things |
| Slow zoom on everything | "Ken Burns" as a reflex | one push on the hero shot; the rest still or moving with a reason |
| Drop shadows and glows on all text | muddy, dated | contrast from the ground, or a solid `background` box |
| A different transition at every cut | noise | cuts inside a scene, 1–2 transition kinds between scenes ([transitions.md](transitions.md)) |
| Stock phrases on screen that repeat the voice-over | the viewer reads and hears the same thing | on-screen text = the keyword or the number; the voice says the sentence |
| Fake UI drawn with rectangles | reads as a mockup | the real screen from `caju capture` or a screenshot the user gives |

## Defaults Caju users usually want
- Brand first: colors and fonts from `.caju/preferences.json` or `assets/capture/tokens.json`.
- Plenty of margin: keep text well inside the safe area, not touching it.
- Big, short type: 3–7 words per frame on social formats.
- A real ending: logo + one-line CTA held ≥ 2 s, nothing important in the last 0.5 s.

## Self-check before showing the user
Name, frame by frame, every default from the table that is on screen. If you can name it, fix it or tell the user why it stays.
