---
title: Video by code
description: Write a Caju video in TypeScript with defineProject (video.ts) and caju build - scenes, elements, enter/exit animation, audio, components, and the full builder API reference.
---

# Video by code

A project can be written in TypeScript: `projects/<id>/video.ts` default-exports `defineProject(...)`, and `caju build <id>` turns it into `project.json`. Every element becomes a **separate, editable clip** in the Studio.

```bash
npx caju build <id> [--dry-run] [--force] [--dir projects]
```

- The folder name must equal the `id` in `defineProject`.
- Don't run `caju new` first: `caju build` creates `project.json`.
- `video.ts` runs with `tsx`; there is no compile step.
- Validate afterwards: `npx caju check <id>`.

## Complete example

```ts
// projects/promo/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'promo', name: 'Promo', format: 'reel-9x16', background: '#171512', duration: 300 },
  (p) => {
    const { width, height } = p.settings;
    const vo1 = { durationSec: 3.4 }; // measured with measureMedia() or ffprobe
    p.asset({ id: 'vo-01', kind: 'audio', name: 'Voice 1', src: 'assets/audio/vo/vo-01.wav', meta: vo1 });
    p.asset({ id: 'mus-bed', kind: 'audio', name: 'Music', src: 'assets/audio/music/mus-bed.mp3', meta: { durationSec: 30 } });
    p.asset({ id: 'logo', kind: 'image', name: 'Logo', src: 'assets/images/logo.svg', meta: { width: 600, height: 180 } });

    p.tracks(['Background']); // named tracks, bottom → top

    // full-length background: its own scene + a named track
    p.scene('bg', 'Background', 0, 300, (s) => {
      s.rect(width, height, { fill: '#171512' },
             { id: 'bg', x: width / 2, y: height / 2, locked: true, exit: false, track: 'Background' });
    }, { marker: false });

    p.scene('opening', 'Opening', 0, 150, (s) => {
      s.image('logo', 600, 180, { id: 'logo', x: width / 2, y: 520, enter: { at: 0, dur: 15, pop: true } });
      s.text('Code it.\nThen move it.', { size: 110, weight: 800, color: '#FFF8E9' },
             { id: 'title', x: width / 2, y: 960, enter: { at: 12, dur: 18, rise: 40 } });
    }, { exit: 12 });

    p.scene('number', 'Number', 150, 300, (s) => {
      // custom React component from components/
      s.component('CountUp', { from: 0, to: 87, suffix: '%' }, { id: 'counter', y: 820, at: [0, 120] });
    });

    // audio: the id prefix picks the track (vo- → "locucao", mus- → audio-mus-N, sfx-, amb-)
    p.audioClip('vo-01', 15, Math.ceil(vo1.durationSec * 30), 'Voice 1', { id: 'vo-01-clip', fadeOut: 3 });
    p.audioClip('mus-bed', 0, 20, 'Music (intro)', { id: 'mus-bed-a', volume: 0.6, fadeIn: 10, fadeOut: 8 });
    p.audioClip('mus-bed', 12, 288, 'Music (under VO)', { id: 'mus-bed-b', trimIn: 12, volume: 0.2, fadeIn: 8, fadeOut: 45 });
  },
);
```

::: tip Give every element a stable `id`
`caju build` matches clips by id to tell what the Studio changed. Auto-generated ids (`<scene>-<n>-<type>`) shift when you insert elements.
:::

## `defineProject(meta, build)`

| `meta` field | Type | Notes |
|---|---|---|
| `id` | `string` | equals the folder name |
| `name` | `string?` | display name (default: `id`) |
| `format` | `FormatId` | `reel-9x16`, `feed-4x5`, `square-1x1`, `landscape-16x9`; sets size and fps |
| `background` | `string?` | hex color (default `#000000`) |
| `duration` | `number?` | frames; omit it to end at the last clip |

`build(p)` may be `async`, for example to measure media with `measureMedia(file)` (uses ffprobe):

```ts
import { defineProject, measureMedia } from '@caju-motion/sdk';

export default defineProject({ id: 'vo', format: 'reel-9x16' }, async (p) => {
  const vo = await measureMedia('projects/vo/assets/audio/vo/vo-01.wav');
  // vo = { durationSec, width?, height?, fps?, hasAudio, hasVideo }
  const frames = Math.ceil(vo.durationSec! * p.settings.fps);
  // ...
});
```

## Project API `p`

| Member | Effect |
|---|---|
| `p.settings` | `{ format, width, height, fps, duration }` of the format |
| `p.sec(seconds)` | seconds → integer frames (`Math.round`) |
| `p.asset({ id, kind, name?, src, meta })` | registers an asset; returns its id |
| `p.tracks(['a', 'b'])` | declares named tracks, bottom → top (below all unnamed layers) |
| `p.scene(id, label, from, to, s => …, { exit = 10, marker = true })` | absolute window `[from, to)`; adds marker `m-<id>` unless `marker: false` |
| `p.marker(id, frame, label)` | marker `m-<id>` (ids are global) |
| `p.audioClip(assetId, start, duration, name, { id, volume = 1, fadeIn = 0, fadeOut = 0, trimIn = 0 })` | absolute frames. **Always pass `id`** for non-voice audio: the default id is `vo-<assetId>` |
| `p.component(name, props, el)` | component clip with absolute times (`el.at`, default: the whole video), on a "Componentes" track |

## Scene API `s`

Times inside a scene are **relative to the scene start**.

| Member | Notes |
|---|---|
| `s.text(text, style, el)` | `style`: `{ size, weight? = 400, font? = 'Plus Jakarta Sans' or 'Red Hat Display', color?, align?, spacing?, lh? = 1.15, bg? }`. `align` also sets the anchor (left → `x` is the left edge) |
| `s.rect(w, h, { fill?, stroke?, sw?, ellipse? }, el)` | shape (`ellipse: true` for circles) |
| `s.image(assetId, w, h, el)` | the asset must be registered first |
| `s.component(name, props, el)` | custom component; `x`/`y` default to the frame center; `el.width`/`el.height` set the box |
| `s.from`, `s.to`, `s.duration`, `s.id` | scene bounds |

### Element options `el`

| Option | Meaning |
|---|---|
| `id` | stable clip id (recommended) |
| `x`, `y` | anchor position in project pixels |
| `at: [a, b]` | clip window inside the scene. Default `[enter.at ?? 0, scene end]` |
| `enter: { at, dur = 18, rise?, dx?, pop?, easing = 'softOut' }` | opacity 0 → 1, plus `y + rise → y`, `x + dx → x`, and scale `× 0.6 → 1` with `backOut` when `pop` |
| `exit` | frames of fade-out at the scene end, or `false`. Default: the scene's `exit` |
| `kf: { 'transform.x': [[frame, value, easing?], …] }` | extra keyframes, frames relative to the **scene** |
| `track` | a named track (declared with `p.tracks`). Overlaps spill to "name 2" |
| `name`, `anchorX`, `anchorY`, `scale`, `rotation`, `opacity`, `flipX`, `blend`, `locked` | clip fields |

## Track layout produced

From bottom to top:

1. `main` (empty).
2. Named tracks, in `p.tracks()` order.
3. Unnamed visual layers `camada-N`: the N-th shape/image/component of each scene shares layer N.
4. Unnamed text layers `texto-N`.
5. Audio: `locucao`, then `audio-<prefix>-<n>`.

**An element that spans several scenes must use a named track**, or it collides with the next scene's layer.

## Rebuilding after Studio edits

`caju build` merges instead of overwriting:

| Clip | Result |
|---|---|
| Made in the Studio | kept |
| From code, untouched | replaced by the new version |
| From code, edited in the Studio | **conflict**: nothing is written, the diff is printed |

Use `--dry-run` to preview and `--force` to let the code win (the previous file goes to `.caju/history/`). See [Caju Studio](./studio#conflicts).

## Other SDK exports

| Export | Use |
|---|---|
| `measureMedia(file)` | ffprobe wrapper (duration, size, fps, audio/video streams); honors `FFPROBE_PATH` |
| `buildProject(def)` | runs a definition and returns the validated `Project` |
| `buildProjectDir(dir, opts)` | what `caju build` does, programmatically |
| `ProjectBuilder`, `guardOverwrite` | legacy standalone scripts (`scripts/examples/builder.ts`) that write `project.json` themselves |
