# Images

## Format choice
| Content | Format |
|---|---|
| Logos, icons, flat illustrations, diagrams | **SVG** (sharp at any scale). Fall back to PNG when the SVG uses filters or fonts |
| Photos, screenshots | **JPG** (quality 85–90) or **WebP** |
| Anything that needs transparency and is not vector | **PNG** (or WebP with alpha) |

## Size
- Export at roughly the size it will occupy on screen at scale 1. The maximum is about the project resolution (1080×1920 for reels, 1920×1080 for 16:9).
- Bigger files slow the Studio and the render without improving quality.
- Plan to zoom in (Ken Burns, `transform.scale` up to 1.3)? Export ×1.3 bigger, not ×4.
- Keep each file under ~2 MB.

## SVG rules
- Must have a `viewBox` and explicit `width`/`height`.
- Text inside an SVG uses the *browser's* fonts. Convert text to paths, or rasterize, for exact looks.
- Rasterizing an SVG to PNG at a fixed size, when needed:
  ```ts
  import sharp from 'sharp';
  await sharp('src/art/scene-1.svg', { density: 300 }).resize(1080).png().toFile('assets/images/scene-1.png');
  ```
- Keep source SVGs outside `assets/` (e.g. `projects/<id>/.caju/art/` or your repo's `art/`) when only the PNG is used.

## Placing an image clip
```json
{ "id": "logo", "type": "image", "assetId": "logo-acme", "start": 0, "duration": 90,
  "transform": { "x": 540, "y": 400, "scale": 1 },
  "props": { "width": 600, "height": 180 } }
```
- `transform.x/y` is the position of the **anchor** (default: the center) in project pixels.
- `props.width/height` is the display box. Keep the image's aspect ratio, or it will stretch.
- To fill the frame (background): `width`/`height` = project size, `x`/`y` = project center. Set `"locked": true` so clicks in the Studio pass through.
