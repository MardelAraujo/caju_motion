# Export settings

These are the same options as the Studio's Exportar popover (`packages/editor/src/app/exportSettings.ts`).

## Format
| Option | Codec | Use for |
|---|---|---|
| `mp4-h264` (default) | H.264 + AAC | Everything: social, web, WhatsApp, presentations |
| `mp4-h265` | HEVC | Smaller files for modern devices (avoid for old Windows players) |
| `mov-prores` | ProRes 422 | Hand-off to editors (Premiere/Resolve/Final Cut) |
| `webm-vp9` | VP9 + Opus | Web embeds |
| `gif` | GIF (no audio) | Short loops < 10 s, ≤ 720p |
| `png-seq` | PNG frames | Compositing, frame-exact review |

## Resolution (shorter side)
- `720p`, `1080p` (native for every preset format), `2K`, `4K`.
- Output dimensions keep the project's aspect ratio and are rounded to even numbers.
- Upscaling above native doesn't add detail. Use it only when a platform requires it.

## FPS
Match `settings.fps`. 30 is the default; 24 gives a cinematic look; 60 suits smooth UI motion. Changing fps at export drops or duplicates frames.

## Quality (CRF for H.264/H.265/VP9)
| Preset | CRF | Use |
|---|---|---|
| Rascunho | 28 | Quick review |
| Boa | 23 | Web |
| **Alta** (default) | 18 | Social / final delivery |
| Máxima | 14 | Archival, re-editing |

## Platform cheat-sheet
| Platform | Format | Settings |
|---|---|---|
| Reels / TikTok / Shorts | `reel-9x16` | mp4-h264, 1080p, 30 fps, Alta |
| Instagram feed | `feed-4x5` | mp4-h264, 1080p, 30 fps, Alta |
| YouTube / LinkedIn / slides | `landscape-16x9` | mp4-h264, 1080p (or 4K), 30 fps, Alta |
