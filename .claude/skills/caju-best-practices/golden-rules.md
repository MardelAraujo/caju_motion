# Golden rules (explained)

## 1. The document is the truth
- `project.json` holds everything: settings, assets, tracks, clips, keyframes and markers.
- Preview and export are pure functions of `(document, frame)`. Anything not in the document will not appear in the video.
- After any change, validate with `npm run caju -- check <id>` (or `npx caju check <id>` later).

## 2. Integer frames
- Every time value in the document is an integer frame: `start`, `duration`, `trimIn`, keyframe `frame`, audio `fadeIn`/`fadeOut`, marker `frame`.
- Convert seconds with `Math.round(seconds * fps)`. Never store `1.5`.
- Keyframe frames are **relative to the clip start**, and must satisfy `0 <= frame < clip.duration`.

## 3. Determinism
Rendering may seek to any frame in any order and in parallel tabs, so a frame must not depend on the past or on the clock.

| Banned | Use instead |
|---|---|
| `Math.random()` | `random(seed)` / `randomRange(seed, min, max)` from `@caju-motion/core` |
| `Date.now()`, `new Date()`, `performance.now()` | the frame (`useFrame()`) |
| `setTimeout`, `setInterval`, `requestAnimationFrame` | the frame |
| CSS `transition:` / `animation:` | `interpolate()` / `spring()` driven by the frame |
| `Intl.*` formatting | format manually (machine locale varies) |

The repo enforces this with `npm run lint` (`scripts/lint-determinism.ts`).

## 4. Never destroy Studio edits
- A project was **edited by a human** when `meta.updatedAt` exists **and** differs from `meta.createdAt` (or `createdAt` is missing).
  - Every Studio save rewrites `updatedAt`.
  - `caju new` writes `createdAt === updatedAt`, and that still means untouched.
  - Generator scripts write neither field.
- Generated clips carry `origin: "code"`; Studio-made clips carry `origin: "editor"`.
- Before regenerating a human-edited project, stop and ask the user. If they agree, back up the file first. See [caju-studio](../caju-studio/SKILL.md).

## 5. Assets are local and relative
- `src` is relative to the project folder, e.g. `assets/images/logo.png`.
- No absolute paths. No `http(s)://` URLs: the render must work offline and be reproducible.

## 6. Validate, then look
- `check` catches schema and consistency errors, plus `CAJU_*` warnings for things that are valid but come out wrong (unknown motion names, off-frame or unsafe text, tiny text, low contrast, empty stretches).
- It cannot judge looks. Run `caju snapshot <id> --at-cuts` and **open the contact sheet**: first frame, every clip, every cut, last frame. Fix what you see before asking the user ([review-loop.md](review-loop.md)).
