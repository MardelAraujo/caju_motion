# Motion principles (mapped to Caju)

Frame counts are at 30 fps. Presets and poses are in caju-authoring → [motion.md](../caju-authoring/motion.md) and [animation.md](../caju-authoring/animation.md).

## 1. One dominant direction
Pick the film's direction of travel (usually left → right for progress, or bottom → top for growth) and keep it: entrances come from the same side, exits leave toward the opposite side, transitions follow the same vector ([transitions.md](transitions.md)). Break it once, on purpose, for a turn in the story ("but…").

## 2. Easing by role
| Role | Caju easing | Frames |
|---|---|---|
| Arrival of a title or card (lands and settles) | `expoOut` (big moves) or `softOut` (small moves) | 14–24 |
| Playful pop (badge, number, sticker) | `backOut` (pose `pop`) | 10–16 |
| Move between two on-screen positions, color floods, camera push | `easeInOut` / `expoInOut` | 18–40 |
| Exit | the mirrored entrance (automatic for `transitionOut`/`animationOut`) or `easeIn` keyframes | 40–50 % of the entrance: 6–12 |
| Constant motion (ticker, progress, rotation) | `linear` | — |
| Step change (counter digits, blink) | `hold` | — |

`softOut` everywhere at the same speed is the flat default that makes a film feel generated: vary by role.

## 3. Entrances decelerate, exits accelerate
- Caju mirrors exits: a `slide` with `expoOut` entering from the right leaves to the right, accelerating. To leave toward the other side, set a different `direction` on the exit.
- Exits are shorter than entrances; landing takes longer than leaving.
- An exit is one smooth move. Never slide, stop, then fade.

## 4. Scene rhythm: build, breathe, resolve
Inside each scene:
- **0–30 % build:** the elements arrive, offset and staggered.
- **30–70 % breathe:** everything is still and readable; the voice carries it. At most one small move (a highlight, a number counting).
- **70–100 % resolve:** the payoff lands (the number, the logo), then the exit or the cut.

Across the film, **vary pacing**: a fast 1–2 s hook, longer 4–6 s explanation scenes, a quick montage, a held ending. Equal-length scenes feel like slides.

## 5. Offsets and stagger
- The first animation of a scene starts **3–9 frames** after the cut, not on frame 0 (the eye needs a beat to land).
- Stagger related items **3–6 frames** apart (list items, words, cards). Start the next element when the previous is 30–50 % done: fully sequential looks robotic, all at once looks cheap.
- In `video.ts`: `enter: { at: 6 }`, then `at: 10`, `at: 14`… or `animIn` on clips whose `at` windows start 4 frames apart.

## 6. Holds: let text be read
- Readable text stays still on screen for at least **1.5 s + 0.3 s per word** after it lands (6 words ≈ 3.3 s ≈ 100 frames).
- The last line of the film: ≥ 2 s.
- A landed title stays **dead still**: no float, no slow zoom. Motion moves on to the next element.

## 7. Sizes of moves
- Text-sized elements: 30–80 px (`rise`/`drop` `distance`, `slide` with `distance`).
- Full-frame moves: `slide` with `distance: 0` (whole frame).
- Pops: `zoom` with `from: 0.8–0.9` reads premium; `pop` (0.4 → 1, overshoot) reads playful. Use `pop` sparingly.

## 8. Loops and continuous motion
- Good continuous motion: footage playing, a product UI working, a counter counting, a slow background drift on a large shape.
- Loops (`float`, `pulse`, `wiggle`, `breathe`) only on secondary elements, at `amplitude` 0.3–0.8 and a period of 60–120 frames.

## 9. Cutting on sound
- A cut or a hit lands on the beat (`caju beats` → `frame = round(sec * fps)`), a layout change on the downbeat.
- A whoosh starts 3–5 frames before the motion peaks; a pop SFX lands on the scale peak (caju-audio → mixing).

## Quick fixes when the user says
| They say | Change |
|---|---|
| "too fast" | lengthen entrances ×1.3 and holds by 0.5 s; don't touch the voice |
| "too slow / boring" | cut the breathe phase, shorten scenes, add one more cut, not more motion |
| "busy" | remove a third of the moves; keep the ones that lead the eye |
| "the title keeps moving" | remove its loop and keyframes after landing |
| "looks like slides" | vary scene lengths; carry an element across a cut; use the vector law |
