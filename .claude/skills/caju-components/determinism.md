# Determinism

The renderer may render frame 900 before frame 10, in parallel browser tabs, and re-render any frame at any time. **Pixels must depend only on `(props, frame)`.**

## Banned (enforced by `npm run lint`)
| Pattern | Replacement |
|---|---|
| `Math.random()` | `random('seed')`, with a seed that is stable per element (its id + index) |
| `Date.now()`, `new Date()`, `performance.now()` | `useFrame()` / `fps` |
| `setTimeout`, `setInterval`, `requestAnimationFrame` | derive the value from the frame |
| CSS `transition:` / `animation:` / `@keyframes` | `interpolate`/`spring` → inline style |
| `Intl.*` (numbers, dates) | manual formatting, e.g. `n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')` |

A justified exception: add a `frame-lint-allow` comment on the same line, with the reason.

## Also avoid
- `useState`/`useEffect` that accumulate across frames, e.g. counters incremented per render, or physics stepped per frame. Compute from the frame instead: `spring()` is analytic for this reason.
- Fetching inside render. Load data before the render (a generator script writes it into props), or use `delayRender` with a module-level cache.
- Layout that depends on the timing of font loading. Fonts must be ready (`document.fonts.ready` is awaited in render mode).
- `video.play()`: video elements are seeked by the renderer, never played, during export.

## Self-check
Render the same frame twice, plus out of order (e.g. 120 → 30 → 120). The output must be identical.
