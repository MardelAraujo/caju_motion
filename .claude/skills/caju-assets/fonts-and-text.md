# Fonts

## Available today (v0.1.0)
Text clips can only use fonts the Studio already loads:

| `props.fontFamily` | Weights | Character |
|---|---|---|
| `"Plus Jakarta Sans"` | 400, 500, 600, 700, 800 | Geometric, friendly (default; the Caju brand font) |
| `"Red Hat Display"` | 400, 700, 800 | Clean geometric sans |

Any other family falls back to the browser's `sans-serif`, and the result will differ between machines. **Don't use it.**

**Local fonts (repo checkout only):** a `fonts.css` plus woff2 files placed in `packages/studio/public/fonts/local/` (git-ignored) are loaded by the Studio. Use this only for fonts that can't be redistributed. They exist only on that machine.

## Brand fonts (until font assets ship in F2)
- Use the closest available family for live text.
- If the exact brand font is mandatory, render the text in an SVG with the text converted to paths, or as a PNG, and place it as an **image** asset. The text then can't be edited in the Studio, so tell the user.
- Store the font file under `assets/fonts/` anyway (woff2) so it is ready for F2. Check that its license allows embedding and redistribution.

## Text basics (details in caju-authoring)
- Text never wraps automatically (`white-space: pre`). Insert `\n` where lines should break.
- Keep titles ≥ 64 px and body ≥ 40 px for 1080-wide video. Keep everything inside the format's safe area.
