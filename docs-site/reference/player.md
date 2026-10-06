---
title: '@caju-motion/player'
description: Embed a Caju Motion video (project.json) in any React app with the <Player> component - controls, audio, custom components, play range, loop and an imperative ref API.
---

# `@caju-motion/player`

`<Player>` plays a `project.json` inside your own React app, with the same renderer the Studio and `caju render` use. Nothing is encoded: frames are drawn live as DOM, so the preview matches the export.

```bash
npm install @caju-motion/player react react-dom
```

```tsx
import { Player } from '@caju-motion/player';
import project from './projects/meu-video/project.json';

export function Hero() {
  return <Player project={project} assetBase="/videos/meu-video/" controls loop autoPlay initiallyMuted />;
}
```

The player fills the width of its parent and keeps the video's aspect ratio. For a fixed box, give it a `style` with a `width` and a `height` (e.g. 360 × 640). The video is scaled to fit (contain) and centered.

## Assets

Asset `src` values in `project.json` are relative (`assets/images/logo.png`). Tell the player where they are served:

| Prop | URL used for each asset |
|---|---|
| `assetBase="/videos/x/"` | `/videos/x/` + `asset.src` (each path segment URL-encoded) |
| `resolveAsset={(asset) => url}` | whatever you return; takes priority over `assetBase` |
| neither | `asset.src` as is |

Copy the project's `assets/` folder to your app's static files (e.g. `public/videos/x/assets/`) and point `assetBase` at the parent folder.

## Custom components

Pass the `defineComponent` definitions the project uses. They apply only to this player, so two players on the same page can use different components.

```tsx
import * as components from './components/Counter';
<Player project={project} components={Object.values(components)} />
```

## Props

| Prop | Default | |
|---|---|---|
| `project` | — | the `project.json` object (any known schema version; migrated and validated) |
| `assetBase`, `resolveAsset` | — | see [Assets](#assets) |
| `components` | `[]` | `defineComponent` definitions for `component` clips |
| `controls` | `false` | play/pause, seek bar, time, mute |
| `autoPlay` | `false` | browsers block autoplay with sound until a click; combine with `initiallyMuted` |
| `loop` | `false` | restart at `inFrame` after `outFrame` |
| `inFrame`, `outFrame` | whole video | frames played (inclusive) |
| `initialFrame` | `inFrame` | |
| `playbackRate` | `1` | |
| `initiallyMuted`, `initialVolume` | `false`, `1` | |
| `clickToPlay` | `controls` | clicking the video toggles play/pause |
| `keyboard` | `true` | with the player focused: Space toggles, ←/→ step one frame (Shift: one second) |
| `style`, `className` | — | on the outer box |
| `onPlay`, `onPause`, `onEnded`, `onFrameUpdate(frame)` | — | `onEnded` fires after `onPause` when playback reaches `outFrame` without `loop` |
| `onError(message)` | — | invalid project; the player shows the schema error instead of crashing |

## Ref API

```tsx
import { useRef } from 'react';
import { Player, type PlayerRef } from '@caju-motion/player';

const ref = useRef<PlayerRef>(null);
<Player ref={ref} project={project} />;

ref.current?.seekTo(90);
ref.current?.play();
```

| Method | |
|---|---|
| `play()`, `pause()`, `toggle()` | `play()` at the end restarts from `inFrame` |
| `seekTo(frame)` | clamped to `inFrame`–`outFrame` |
| `getCurrentFrame()`, `isPlaying()` | |
| `mute()`, `unmute()`, `isMuted()` | |
| `setVolume(0–1)`, `getVolume()` | multiplies each clip's own volume |
| `getContainer()` | the outer `div` (e.g. for fullscreen) |

## Notes

- Requires React 19.
- Audio tracks play through `<audio>` elements kept in sync with the frame. For frame-exact audio, render a file with [`caju render`](../guide/rendering).
- The player runs in the browser. With server rendering it outputs its markup hidden, and shows the video once it has measured its box after hydration.
