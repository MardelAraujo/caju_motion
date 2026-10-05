# Animation: keyframes and easing

## Keyframes
```json
"keyframes": {
  "opacity":         [{ "frame": 0, "value": 0, "easing": "softOut" }, { "frame": 18, "value": 1 }],
  "transform.y":     [{ "frame": 0, "value": 1000, "easing": "softOut" }, { "frame": 18, "value": 960 }],
  "props.color":     [{ "frame": 30, "value": "#FFFFFF", "easing": "easeInOut" }, { "frame": 45, "value": "#F6B73C" }]
}
```
- Keys are property paths: `opacity`, `transform.x|y|scale|rotation`, `props.<name>`.
- `frame` is relative to the **clip start**, an integer, `< duration`.
- `easing` sits on the keyframe where a segment **starts**: it shapes the movement from that keyframe to the next. The last keyframe's easing is unused.
- Before the first keyframe the value holds at the first keyframe's value; after the last, it holds at the last.
- Numbers interpolate, hex colors blend, other strings step.
- When a path has keyframes, they override the static value (`opacity`, `transform.y`…) while the clip plays.

## Easing presets
| preset | use for |
|---|---|
| `softOut` | default entrance (gentle decelerate) |
| `expoOut` | snappy entrance, big moves |
| `backOut` | pops and scale-ins (slight overshoot) |
| `easeInOut` | moves between two on-screen positions |
| `easeIn` | exits |
| `expoInOut` | dramatic transitions |
| `linear` | constant motion (tickers, progress bars) |
| `hold` | jump to the next value at the next keyframe (blinks, step counters) |

A custom curve: `"easing": { "bezier": [0.22, 1, 0.36, 1] }`.

## Recipes (frames at 30 fps)
- **Fade + rise in:** opacity 0→1 and y +16…+40 → y, over 15–24 frames, `softOut`.
- **Pop in:** scale 0.6→1 over 12–18 frames, `backOut`, together with an opacity fade.
- **Slide in:** x ± 80–200 → x, 18–24 frames, `expoOut`.
- **Exit:** opacity 1→0 over the last 8–16 frames (`easeIn`). The last keyframe must be at `duration - 1`.
- **Line reveal:** `props.width` 0 → W, 20–35 frames, `easeInOut`, with `anchorX: 0` so it grows to the right.
- **Stagger:** start each item's clip 3–6 frames after the previous one.
- **Ken Burns:** scale 1→1.12, `linear`, across the whole clip.

## Keep the JSON small
- Use **2–4 keyframes per property** with easing presets. Don't bake every frame or every 5 frames: that bloats the file and makes Studio editing impossible.
- Hold values by duplicating a keyframe (`frame: 125, value: 1, easing: "easeIn"` → `frame: 137, value: 0`) instead of adding intermediate frames.
