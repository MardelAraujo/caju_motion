# Elements, layout and safe areas

## Transform (all visual clips)
```json
"transform": { "x": 540, "y": 960, "scale": 1, "rotation": 0, "anchorX": 0.5, "anchorY": 0.5, "flipX": false, "flipY": false }
```
- `x`/`y`: where the **anchor point** sits, in project pixels. The origin is the top-left of the frame.
- `anchorX`/`anchorY`: a fraction of the element's own box. `0.5, 0.5` = center; `0, 0.5` = left-middle, so `x` is the left edge.
- `scale` multiplies the element. Animate `transform.scale` for zoom and pop effects.
- `rotation` is in degrees, clockwise.

## text
```json
"props": { "text": "Linha 1\nLinha 2", "fontFamily": "Plus Jakarta Sans", "fontSize": 96, "fontWeight": 800,
           "color": "#FFFFFF", "align": "center", "lineHeight": 1.1, "letterSpacing": 0, "background": "" }
```
- **No automatic wrapping**: break lines with `\n`. Estimate width ≈ `0.55 × fontSize × characters` per line for Red Hat Display. Keep it inside the safe area.
- `fontFamily`: `"Red Hat Display"` (400/700/800) or `"Plus Jakarta Sans"` (400–800). Others aren't loaded (caju-assets → fonts).
- `background`: hex for a highlight box, or `""` for none.
- `align` + `anchorX` should agree: left-aligned text uses `anchorX: 0`.
- Keyframes can animate `props.color` (hex is interpolated), `props.fontSize`, `props.letterSpacing`, and `props.text` (steps, no interpolation).

## shape
```json
"props": { "shape": "rect", "width": 400, "height": 400, "fill": "#FFFFFF", "stroke": "", "strokeWidth": 0 }
```
- `shape`: `rect` or `ellipse`. `fill`/`stroke`: hex. `#RRGGBBAA` is allowed for transparency, and `""` means none.
- Animate `props.width` from 0 for line reveals. A full-frame rect on track 0 is the usual background.

## image / video
- `props.width`/`props.height` set the display box. **Always set them**, or set `meta` on the asset; the fallback is 1920×1080.

## Formats and safe areas (px insets the platform UI covers)
| format | size | safe top / right / bottom / left |
|---|---|---|
| `reel-9x16` | 1080×1920 | 250 / 60 / 420 / 60 |
| `feed-4x5` | 1080×1350 | 80 / 80 / 80 / 80 |
| `square-1x1` | 1080×1080 | 72 / 72 / 72 / 72 |
| `landscape-16x9` | 1920×1080 | 54 / 96 / 120 / 96 |

- Keep text and logos fully inside the safe area. Backgrounds may bleed.
- On reels, the bottom 420 px is covered by captions and buttons, so put CTAs around y = 1300–1450.

## Layering
- `tracks[0]` is the back. A common order: `main` (backgrounds) → `overlay` tracks (images, shapes) → `text` tracks → `audio` tracks (audio tracks don't draw).
- One element per track per moment. Elements that coexist in time need separate tracks.
- `blendMode` (`multiply`, `screen`, `overlay`, `soft-light`…) for lights and shadows. `"locked": true` for full-frame layers so Studio clicks pass through.
