---
name: caju-render
description: Export Caju Motion projects to video or stills, choose codec/resolution/fps/quality, and verify the output (duration, resolution, audio, A/V sync). Use when the user asks to render, export, download, publish or preview a frame of a Caju video.
version: 0.1.0
---

# Rendering Caju videos

## Availability (v0.1.0): read first
| Capability | Today | Planned |
|---|---|---|
| Full video export (MP4 etc.) | **Not available.** The Studio's Exportar popover saves settings only | `caju render` / Studio export (F1) |
| Single frame (PNG) | ✓ headless Chrome on the `?render=` URL | `caju still` (F1) |
| Cloud / distributed render | ✗ | `@caju-motion/cloud` (F4, commercial) |

When the user asks for an MP4 today, say plainly that full export arrives with the renderer (F1). Offer:
- (a) key-frame stills;
- (b) a screen recording of the Studio preview as a draft;
- (c) the validated project, ready to render later.

## Stills today
With the Studio running (`npm run studio`, port 3700), capture a frame at the project's own resolution:
```bash
chrome --headless=new --window-size=1080,1920 --virtual-time-budget=8000 \
  --screenshot=out/promo-f0090.png "http://localhost:3700/?render=promo&frame=90"
```
- Use `msedge` on Windows if `chrome` is not on PATH.
- `--window-size` must equal `settings.width,height`.
- Frame numbers are absolute project frames.
- Good review frames: 0, every scene start + 15, the last frame − 1.

## Choosing settings (applies to F1 and the Exportar popover)
See [export-settings.md](export-settings.md).

## Verifying an exported file
See [verify-output.md](verify-output.md). Always verify before telling the user it is done.
