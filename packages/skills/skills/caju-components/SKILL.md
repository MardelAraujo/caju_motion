---
name: caju-components
description: Create custom animated React components for Caju Motion (defineComponent in components/, zod props that become Studio controls, frame-driven animation with useFrame/interpolate/spring) and use them in videos. Use when keyframes are not enough — counters, charts, lower thirds, kinetic text, data-driven graphics — or when contributing to the Caju renderer.
version: 0.2.0
---

# Caju components

A component is a React function, driven only by the current frame, that appears in Caju Studio's **Componentes** tab and can be used from `video.ts`.
- Its props are a zod schema, and the Studio's inspector edits them automatically.
- The same code renders in preview and in `caju render`.

## Where they live
- One file per component (or `<Folder>/index.tsx`) in **`components/`** next to the projects folder. In the repo checkout that is `components/` at the root; otherwise it is `--components <dir>`.
- The Studio compiles the folder with esbuild and **hot-reloads on save**. A compile error shows in the Studio and the last good version keeps working.
- `caju check` compiles it, runs the determinism lint on it, and reports clips that reference a missing component.

## Anatomy
```tsx caju-check
// components/Badge.tsx
import { Easing, interpolate, spring, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  text: z.string().default('Novo').describe('Texto'),
  color: z.string().describe('color').default('#F6B73C'), // .describe('color') → color picker in the Studio
  size: z.number().min(24).max(400).default(96).describe('Tamanho'), // min/max → slider
  rounded: z.boolean().default(true).describe('Arredondado'),
  align: z.enum(['left', 'center', 'right']).default('center').describe('Alinhamento'),
});
type Props = z.infer<typeof schema>;

function Badge({ text, color, size, rounded, align }: Props) {
  const frame = useFrame(); // frame relative to the clip start
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const y = interpolate(frame, [0, 12], [30, 0], { easing: Easing.softOut });
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
      <span style={{ background: color, color: '#171512', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800,
                     fontSize: size, padding: '0.2em 0.6em', borderRadius: rounded ? '999px' : 0,
                     opacity: enter, transform: `translateY(${y}px) scale(${0.8 + 0.2 * enter})` }}>
        {text}
      </span>
    </div>
  );
}

export default defineComponent({
  name: 'Badge', // unique id used in project.json (props.component)
  label: 'Selo', // shown in the Studio
  description: 'Selo com entrada em mola.',
  schema,
  width: 800, // default box when added (px of the project)
  height: 240,
  durationInFrames: 90, // default clip length when added in the Studio
  component: Badge,
});
```
- The component fills its clip box (`width`/`height`). Lay it out with `width: '100%'; height: '100%'`.
- Position, scale, rotation, opacity and keyframes come from the clip, as with any other element.
- Invalid or missing props fall back to the schema defaults. An unknown component name renders a visible placeholder, never a crash.
- Inspector mapping:
  - `z.string()` → text field;
  - `.describe('color')` → color picker;
  - `z.number().min().max()` → slider; plain number → number field;
  - boolean → toggle;
  - enum → choices;
  - other types → JSON field.
  - Other `.describe('…')` texts become the field label.

## Using a component
- **In the Studio:** Componentes tab → click or drag the card onto the timeline. Edit props in the right panel.
- **In code:** `s.component('Badge', { text: 'Novo' }, { id: 'selo', y: 400, at: [0, 60] })` inside a scene (caju-authoring → generator-script.md).
- **In JSON:** `{ "type": "component", "props": { "component": "Badge", "text": "Novo" }, … }` on an `overlay` or `text` track.

## Runtime API (`@caju-motion/core`)
| API | Notes |
|---|---|
| `useFrame()` / `useAbsoluteFrame()` | relative to the clip/`<Sequence>` / absolute in the project |
| `useVideoConfig()` | `{ width, height, fps, durationInFrames }` |
| `<Sequence from duration?>`, `<Fill>` | time windows inside a component; full-box layer |
| `interpolate(x, inRange, outRange, { easing, extrapolateLeft/Right })` | clamps by default |
| `spring({ frame, fps, config, from, to, delay })` | analytic, seekable; presets `springPresets.ui/settle/bouncy/heavy` |
| `Easing.*`, `cubicBezier()` | same presets as keyframes |
| `random(seed)`, `randomRange(seed, min, max)` | deterministic randomness |
| `delayRender(label)` / `continueRender(handle)` | hold the render until async data/images are ready |

## Rules
See [determinism.md](determinism.md).
- Pixels depend only on `(props, frame)`: no `Math.random`, `Date`, timers, CSS transitions or animations, or `Intl`. The lint enforces this in `components/`.
- Fonts: use the families the Studio loads (`'Plus Jakarta Sans'`, `'Red Hat Display'`).
- Bundled into the component: `zod` and your own helpers. Provided by the Studio, a single shared copy: `react`, `@caju-motion/core` and `@caju-motion/renderer`. Don't import other UI libraries that bring their own React.
- `component` names are global. Renaming one breaks existing clips; `caju check` will report them.
