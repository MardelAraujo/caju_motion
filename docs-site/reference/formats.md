---
title: Formats & safe areas
description: Caju Motion project formats (reel 9:16, feed 4:5, square 1:1, landscape 16:9) with sizes, fps and the safe-area insets covered by platform UI.
---

# Formats & safe areas

Formats are presets from `@caju-motion/schema` (`FORMATS`). The format sets the project size and fps; `custom` lets you choose any size.

| Format | Label | Size | fps | Safe top / right / bottom / left (px) |
|---|---|---|---|---|
| `reel-9x16` | Reels / Stories / TikTok (9:16) | 1080×1920 | 30 | 250 / 60 / 420 / 60 |
| `feed-4x5` | Feed (4:5) | 1080×1350 | 30 | 80 / 80 / 80 / 80 |
| `square-1x1` | Square (1:1) | 1080×1080 | 30 | 72 / 72 / 72 / 72 |
| `landscape-16x9` | YouTube / presentation (16:9) | 1920×1080 | 30 | 54 / 96 / 120 / 96 |

The **safe area** is what remains after removing the insets the platform UI covers (captions, buttons, profile). The Studio draws it as an overlay.

- Keep text and logos fully inside the safe area. Backgrounds may bleed.
- On reels, the bottom 420 px is covered by captions and buttons: put CTAs around y = 1300–1450.
- Text never wraps automatically. Estimate a line's width at ≈ `0.55 × fontSize × characters` and break lines with `\n`.
- Keep titles ≥ 64 px and body text ≥ 40 px on 1080-wide video.

## Coordinates

- The origin `(0, 0)` is the **top-left** of the frame; `transform.x/y` is where the element's **anchor** sits.
- `anchorX/anchorY` default to `0.5, 0.5` (center). Left-aligned text uses `anchorX: 0` so `x` is the left edge.

```ts
import { FORMATS } from '@caju-motion/schema';
const { width, height, safe } = FORMATS['reel-9x16'];
const safeBox = { x: safe.left, y: safe.top, w: width - safe.left - safe.right, h: height - safe.top - safe.bottom };
```

## Picking a format

| Destination | Format | Export |
|---|---|---|
| Reels, TikTok, Shorts, Stories | `reel-9x16` | mp4-h264, 1080 |
| Instagram / LinkedIn feed | `feed-4x5` | mp4-h264, 1080 |
| Square posts, ads | `square-1x1` | mp4-h264, 1080 |
| YouTube, websites, slides | `landscape-16x9` | mp4-h264, 1080 or 2160 |

See [Rendering](../guide/rendering#export-settings) for every export option.
