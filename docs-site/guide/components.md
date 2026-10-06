---
title: Components
description: Custom animated React components for Caju Motion - defineComponent, zod props that become Studio inspector controls, hot reload, and using components from the Studio, video.ts and JSON.
---

# Components

When keyframes are not enough (counters, charts, lower thirds, kinetic text, data-driven graphics) write a **component**: a React function driven only by the current frame.

- It appears in Caju Studio's **Componentes** tab and can be used from `video.ts`.
- Its props are a zod schema; the Studio's inspector edits them automatically.
- The same code renders in the preview and in `caju render`.

## Where they live

- One file per component (or `<Folder>/index.tsx`) in **`components/`** next to the projects folder. Override with `--components <dir>`.
- The Studio compiles the folder with esbuild and **hot-reloads on save**. A compile error shows in the Studio and the last good version keeps working.
- `caju check` compiles the folder, runs the determinism lint on it and reports clips that reference a missing component.

## Anatomy

```tsx
// components/Badge.tsx
import { Easing, interpolate, spring, useFrame, useVideoConfig } from '@caju-motion/core';
import { defineComponent } from '@caju-motion/renderer';
import { z } from 'zod';

const schema = z.object({
  text: z.string().default('New').describe('Text'),
  color: z.string().describe('color').default('#F6B73C'), // .describe('color') → color picker
  size: z.number().min(24).max(400).default(96).describe('Size'), // min/max → slider
  rounded: z.boolean().default(true).describe('Rounded'),
  align: z.enum(['left', 'center', 'right']).default('center').describe('Align'),
});
type Props = z.infer<typeof schema>;

function Badge({ text, color, size, rounded, align }: Props) {
  const frame = useFrame(); // relative to the clip start
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const y = interpolate(frame, [0, 12], [30, 0], { easing: Easing.softOut });
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
      <span style={{ background: color, color: '#171512', fontFamily: "'Plus Jakarta Sans', sans-serif",
                     fontWeight: 800, fontSize: size, padding: '0.2em 0.6em', borderRadius: rounded ? '999px' : 0,
                     opacity: enter, transform: `translateY(${y}px) scale(${0.8 + 0.2 * enter})` }}>
        {text}
      </span>
    </div>
  );
}

export default defineComponent({
  name: 'Badge',          // unique id stored in project.json (props.component)
  label: 'Badge',         // shown in the Studio
  description: 'A badge that springs in.',
  schema,
  width: 800,             // default box (project px)
  height: 240,
  durationInFrames: 90,   // default clip length when added in the Studio
  component: Badge,
});
```

## `defineComponent(config)`

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | **required**, global, stored in `clip.props.component`. Renaming breaks existing clips (`caju check` reports them) |
| `component` | React component | **required** |
| `label` | `string?` | card title in the Componentes tab (default: `name`) |
| `description` | `string?` | card description |
| `schema` | zod object? | props schema; invalid or missing values fall back to the defaults |
| `defaultProps` | `object?` | merged over the schema defaults |
| `width`, `height` | `number?` | default box in project px (default: the whole frame) |
| `durationInFrames` | `number?` | default clip length when dragged onto the timeline |

The component **fills its clip box**: lay it out with `width: '100%'; height: '100%'`. Position, scale, rotation, opacity and keyframes come from the clip, like any other element. An unknown component name renders a visible placeholder, never a crash.

## Props → inspector

| zod | Studio control |
|---|---|
| `z.string()` | text field |
| `z.string().describe('color')` | color picker |
| `z.number().min(a).max(b)` | slider |
| `z.number()` | number field |
| `z.boolean()` | toggle |
| `z.enum([...])` | choices |
| anything else | JSON field |

Any other `.describe('…')` text becomes the field label.

## Using a component

**In the Studio:** Componentes tab → click or drag the card onto the timeline, then edit its props in the right panel.

**In `video.ts`:**

```ts
s.component('Badge', { text: 'New' }, { id: 'badge', y: 400, at: [0, 60] });
```

**In `project.json`** (on an `overlay` or `text` track):

```json
{ "id": "badge", "type": "component", "start": 0, "duration": 60,
  "transform": { "x": 540, "y": 400 },
  "props": { "component": "Badge", "text": "New", "width": 800, "height": 240 } }
```

## Rules

- **Deterministic:** pixels depend only on `(props, frame)`. No `Math.random`, `Date`, timers, CSS transitions/animations or `Intl`. Don't accumulate state across frames with `useState`/`useEffect`; compute from the frame (`spring()` is analytic for this reason). See [Concepts](./concepts#determinism).
- **Data:** don't fetch inside render. Pass data in props from `video.ts`, or hold the render with `delayRender` and a module-level cache.
- **Fonts:** use the families the Studio loads: `'Plus Jakarta Sans'`, `'Red Hat Display'`.
- **Dependencies:** `zod` and your helpers are bundled into the component. `react`, `@caju-motion/core` and `@caju-motion/renderer` are provided by the Studio as a single shared copy. Don't import UI libraries that bring their own React.
- **Self-check:** render the same frame twice and out of order (120 → 30 → 120); the output must be identical.

The runtime API (`useFrame`, `interpolate`, `spring`, `Sequence`…) is documented in [@caju-motion/core](../reference/core).
