# Generating projects with code

## Today: `ProjectBuilder` (repo checkout)
`scripts/examples/builder.ts` writes a project **scene by scene**, with times relative to each scene. It handles:
- clip ids and track layout;
- converting enter/exit into keyframes;
- grouping audio tracks by id prefix;
- validation (`ProjectSchema.parse` in `build()`).

**Where the script lives**
- Usually in `scripts/videos/<name>.ts`, run with `npx tsx scripts/videos/<name>.ts`.
- It can also live anywhere else (e.g. a temp folder) if it imports the builder by absolute path or `file:///` URL; `tsx` still resolves `@caju-motion/schema` from the repo.
- **Output folder:** default `projects/<id>`. Accept an `--out <projectsFolder>` argument so the same script can write elsewhere, matching `--dir` in the CLI.
- **Don't run `caju new` first**: the script creates the folder (see caju-studio about `guardOverwrite`).

## Complete example
```ts caju-check
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ProjectBuilder, guardOverwrite } from '../examples/builder';

const ROOT = path.resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: { out: { type: 'string' }, force: { type: 'boolean', default: false } } });
const DIR = path.join(path.resolve(values.out ?? path.join(ROOT, 'projects')), 'promo');
guardOverwrite(DIR, ROOT, values.force ?? false); // refuses to clobber Studio edits (backup goes to <ROOT>/.cache/backups)

const fps = 30;
const TOTAL = 300;
const vo1 = { durationSec: 3.4 }; // measured with ffprobe (caju-audio)
const b = new ProjectBuilder({ id: 'promo', name: 'Promo', format: 'reel-9x16', background: '#0C0B0E', duration: TOTAL });
b.asset({ id: 'vo-01', kind: 'audio', name: 'Locução 1', src: 'assets/audio/vo/vo-01.wav', meta: vo1 });
b.asset({ id: 'mus-bed', kind: 'audio', name: 'Trilha', src: 'assets/audio/music/mus-bed.mp3', meta: { durationSec: 30 } });
b.asset({ id: 'logo', kind: 'image', name: 'Logo', src: 'assets/images/logo.svg', meta: { width: 600, height: 180 } });

b.tracks(['fundo']); // named tracks, bottom → top

// full-length background: its own scene + named track (unnamed layers would collide with other scenes)
b.scene('bg', 'Fundo', 0, TOTAL, (s) => {
  s.rect(1080, 1920, { fill: '#171512' }, { name: 'Fundo', x: 540, y: 960, locked: true, exit: false, track: 'fundo' });
}, { marker: false });

b.scene('abertura', 'Abertura', 0, 150, (s) => {
  s.image('logo', 600, 180, { x: 540, y: 520, enter: { at: 0, dur: 15, pop: true } });
  s.text('Code it.\nThen move it.', { size: 110, weight: 800, color: '#FFF8E9' },
         { x: 540, y: 960, enter: { at: 12, dur: 18, rise: 40 } });
}, { exit: 12 });

// audio: the id prefix picks the track (vo- → "locucao", mus- → audio-mus-N, sfx-, amb-)
b.audioClip('vo-01', 15, Math.ceil(vo1.durationSec * fps), 'Locução 1', { id: 'vo-01-clip', fadeOut: 3 });
// ducking: overlapping segments of the same prefix spill into audio-mus-0 / audio-mus-1 automatically
b.audioClip('mus-bed', 0, 20, 'Trilha (intro)', { id: 'mus-bed-a', volume: 0.6, fadeIn: 10, fadeOut: 8 });
b.audioClip('mus-bed', 12, TOTAL - 12, 'Trilha (sob a voz)', { id: 'mus-bed-b', trimIn: 12, volume: 0.2, fadeIn: 8, fadeOut: 45 });

const project = b.build();
mkdirSync(path.join(DIR, 'assets'), { recursive: true });
writeFileSync(path.join(DIR, 'project.json'), JSON.stringify(project, null, 2) + '\n');
console.log(`✓ ${path.join(DIR, 'project.json')}`);
```
After running: `npm run caju -- check promo [--dir <projectsFolder>]`.

## API reference

### `new ProjectBuilder({ id, name, format, background, duration })`
`format` is a `FormatId` (size and fps come from it); `duration` is in frames.

| Method | Effect |
|---|---|
| `b.asset(asset)` | Registers an asset (`{ id, kind, name?, src, meta }`) and returns its id |
| `b.tracks(['a', 'b'])` | Declares **named** tracks, bottom → top. Named tracks sit below all unnamed layers |
| `b.scene(id, label, from, to, s => …, { exit = 10, marker = true })` | Absolute window `[from, to)`. Adds the marker `m-<id>` unless `marker: false`. `exit` is the default fade-out (frames) for elements that reach the scene end |
| `b.marker(id, frame, label)` | Adds the marker `m-<id>` (ids are global: don't reuse a scene id) |
| `b.audioClip(assetId, start, duration, name, { id = 'vo-'+assetId, volume = 1, fadeIn = 0, fadeOut = 0, trimIn = 0 })` | Absolute frames. **Always pass `id`** for non-VO audio: the default prefix is `vo-` |
| `b.build()` | Validates and returns the `Project`. Throws a readable error |

### Scene context `s` (times relative to the scene)
| Method | Notes |
|---|---|
| `s.text(text, style, el)` | `style`: `{ size, weight?, font?: 'Plus Jakarta Sans' \| 'Red Hat Display', color?, align?, spacing?, lh?, bg? }`. `el.align` also sets the anchor (left → x is the left edge) |
| `s.rect(w, h, { fill?, stroke?, sw?, ellipse? }, el)` | Shape. `ellipse: true` for circles |
| `s.image(assetId, w, h, el)` | The asset must be registered first |
| `s.from`, `s.to`, `s.duration` | Scene bounds |

`el` (ElOpts):
- `x`, `y` (required anchor position).
- `at: [a, b]`: the clip window. Default: `[enter.at ?? 0, scene end]`.
- `enter: { at, dur = 18, rise?, dx?, pop?, easing = 'softOut' }`. It produces:
  - opacity 0 → `opacity`;
  - `rise`: y + rise → y;
  - `dx`: x + dx → x;
  - `pop`: scale × 0.6 → scale with `backOut`.
- `exit`: frames of fade-out, or `false`. Only applies when the clip reaches the scene end; it defaults to the scene's `exit`.
- `kf: { 'transform.x': [[frame, value, easing?], …] }`: frames relative to the **scene**.
- `track: 'name'`: puts the clip on a named track.
- `name`, `anchorX`, `anchorY`, `scale`, `rotation`, `opacity`, `flipX`, `blend`, `locked`.

### Resulting track layout (bottom → top)
1. `main`: always created, empty.
2. **Named tracks**, in `b.tracks()` order. Their ids are rewritten to `tNN-M`. A track's kind is `text` when all its clips are text, otherwise `overlay`. Overlaps spill to a new track "name 2".
3. **Unnamed visual layers** `camada-N`: the N-th shape/image declared in each scene shares layer N across scenes.
4. **Unnamed text layers** `texto-N`, the same way.
5. **Audio:** `locucao` (vo), then `audio-<prefix>-<n>`. Overlapping clips with the same prefix get more lanes.

Consequences:
- An element that spans several scenes must use a **named track**, or it will overlap the next scene's layer of the same index.
- Declare stacking explicitly with named tracks when the order matters across scenes.

## Planned (F2, do not use yet): `@caju-motion/sdk`
```ts
// videos/promo/video.ts
import { defineProject } from '@caju-motion/sdk';
export default defineProject({ id: 'promo', format: 'reel-9x16' }, (p) => { /* same scene API */ });
```
`caju build` will regenerate only `origin: "code"` clips and keep Studio edits.
