# Generating projects with code (`video.ts` + `caju build`)

A project can be written in TypeScript: `projects/<id>/video.ts` default-exports `defineProject(...)`, and `caju build <id>` turns it into `project.json`.
- The project then opens in Caju Studio like any other.
- Re-running `caju build` regenerates only the clips that came from code (`origin: "code"`) and **keeps everything made in the Studio**. See [caju-studio](../caju-studio/SKILL.md).

```bash
npm run caju -- build <id> [--dry-run] [--force] [--dir projects]   # repo checkout
npx caju build <id>                                                 # after release
```
- The folder name must equal the `id` in `defineProject`.
- Don't run `caju new` first: `caju build` creates `project.json`.
- Validate afterwards: `caju check <id>`.

## Complete example
```ts caju-check
// projects/promo/video.ts
import { defineProject } from '@caju-motion/sdk';

export default defineProject(
  { id: 'promo', name: 'Promo', format: 'reel-9x16', background: '#171512', duration: 300 },
  (p) => {
    const { width, height } = p.settings;
    const vo1 = { durationSec: 3.4 }; // measured with measureMedia() (caju-audio)
    p.asset({ id: 'vo-01', kind: 'audio', name: 'Locução 1', src: 'assets/audio/vo/vo-01.wav', meta: vo1 });
    p.asset({ id: 'mus-bed', kind: 'audio', name: 'Trilha', src: 'assets/audio/music/mus-bed.mp3', meta: { durationSec: 30 } });
    p.asset({ id: 'logo', kind: 'image', name: 'Logo', src: 'assets/images/logo.svg', meta: { width: 600, height: 180 } });

    p.tracks(['Fundo']); // named tracks, bottom → top

    // full-length background: its own scene + named track
    p.scene('bg', 'Fundo', 0, 300, (s) => {
      s.rect(width, height, { fill: '#171512' }, { id: 'fundo', x: width / 2, y: height / 2, locked: true, exit: false, track: 'Fundo' });
    }, { marker: false });

    p.scene('abertura', 'Abertura', 0, 150, (s) => {
      s.image('logo', 600, 180, { id: 'logo', x: width / 2, y: 520, enter: { at: 0, dur: 15, pop: true } });
      s.text('Code it.\nThen move it.', { size: 110, weight: 800, color: '#FFF8E9' },
             { id: 'titulo', x: width / 2, y: 960, enter: { at: 12, dur: 18, rise: 40 } });
    }, { exit: 12 });

    p.scene('numero', 'Número', 150, 300, (s) => {
      // custom React component from components/ (caju-components)
      s.component('CountUp', { from: 0, to: 87, suffix: '%' }, { id: 'contador', y: 820, at: [0, 120] });
    });

    // audio: the id prefix picks the track (vo- → "locucao", mus- → audio-mus-N, sfx-, amb-)
    p.audioClip('vo-01', 15, Math.ceil(vo1.durationSec * 30), 'Locução 1', { id: 'vo-01-clip', fadeOut: 3 });
    p.audioClip('mus-bed', 0, 20, 'Trilha (intro)', { id: 'mus-bed-a', volume: 0.6, fadeIn: 10, fadeOut: 8 });
    p.audioClip('mus-bed', 12, 288, 'Trilha (sob a voz)', { id: 'mus-bed-b', trimIn: 12, volume: 0.2, fadeIn: 8, fadeOut: 45 });
  },
);
```

**Give every element a stable `id`.** `caju build` matches clips by id to tell what the Studio changed. Auto-generated ids (`<scene>-<n>-<type>`) shift when you insert elements.

## API reference

### `defineProject({ id, name?, format, background?, duration? }, build)`
- `format` is a `FormatId`: it sets size and fps.
- `duration` is in frames; omit it to end at the last clip.
- `build(p)` may be `async`, for example to measure media with `measureMedia(file)` (bundled FFmpeg, no ffprobe).
- Captions: `s.captions(cues, style, { x, y, track: 'Legendas', offsetSec })` adds one text clip per line, with times in seconds from the scene start. Get cues with `readCaptions('…/locucao.words.json' | '.srt' | '.vtt')` from `@caju-motion/voice` (caju-audio → voiceover-timing).

| Method | Effect |
|---|---|
| `p.settings` | `{ width, height, fps, … }` of the format |
| `p.sec(seconds)` | seconds → frames |
| `p.asset(asset)` | registers an asset (`{ id, kind, name?, src, meta }`) |
| `p.tracks(['a', 'b'])` | named tracks, bottom → top (below all unnamed layers) |
| `p.scene(id, label, from, to, s => …, { exit = 10, marker = true })` | absolute window `[from, to)`. Adds marker `m-<id>` unless `marker: false` |
| `p.marker(id, frame, label)` | marker `m-<id>` (ids are global) |
| `p.audioClip(assetId, start, duration, name, { id, volume = 1, fadeIn = 0, fadeOut = 0, trimIn = 0 })` | absolute frames. **Always pass `id`** for non-VO audio (default prefix is `vo-`) |
| `p.component(name, props, el)` | component clip with absolute times, on a "Componentes" track |

### Scene context `s` (times relative to the scene)
| Method | Notes |
|---|---|
| `s.text(text, style, el)` | `style`: `{ size, weight?, font?: 'Plus Jakarta Sans' \| 'Red Hat Display', color?, align?, spacing?, lh?, bg? }` |
| `s.rect(w, h, { fill?, stroke?, sw?, ellipse? }, el)` | shape |
| `s.image(assetId, w, h, el)` | the asset must be registered first |
| `s.component(name, props, el)` | custom component. `x`/`y` default to the frame center; `el.width`/`el.height` set the box (defaults come from the component) |
| `s.from`, `s.to`, `s.duration` | scene bounds |

`el` (ElOpts):
- `id`: stable clip id (recommended).
- `x`, `y`: anchor position.
- `at: [a, b]`: clip window. Default: `[enter.at ?? 0, scene end]`.
- `enter: { at, dur = 18, rise?, dx?, pop?, easing = 'softOut' }`: produces opacity 0 → 1, plus y + rise → y, x + dx → x, and scale × 0.6 → scale with `backOut`.
- `exit`: frames of fade-out, or `false`. Applies when the clip reaches the scene end; defaults to the scene's `exit`.
- `kf: { 'transform.x': [[frame, value, easing?], …] }`: frames relative to the **scene**.
- `track`: a named track.
- `name`, `anchorX`, `anchorY`, `scale`, `rotation`, `opacity`, `flipX`, `blend`, `locked`.

### Track layout produced (bottom → top)
1. `main` (empty).
2. Named tracks, in `p.tracks()` order. Overlaps spill to "name 2".
3. Unnamed visual layers `camada-N`: the N-th shape/image of each scene shares layer N.
4. Unnamed text layers `texto-N`.
5. Audio: `locucao`, then `audio-<prefix>-<n>`.

**An element that spans several scenes must use a named track**, or it collides with the next scene's layer.

## Legacy: standalone scripts
`scripts/examples/builder.ts` re-exports the same `ProjectBuilder` / `guardOverwrite` for older scripts that write `project.json` themselves. New work should use `video.ts` + `caju build`, which merges Studio edits instead of refusing to overwrite.
