# Palettes and contrast

**The user's brand comes first**: `.caju/preferences.json` → `brand.colors`, or `assets/capture/tokens.json` from `caju capture` (colors with `role: background|text|accent`). Use the palettes below only when there is no brand.

## Rules
- One ground, one text color, **one accent** (plus at most one support color). The accent marks what matters: the number, the key word, the CTA.
- Off-black and off-white instead of `#000`/`#FFF` (house-style.md).
- Contrast (WCAG), checked by `caju check` as `CAJU_LOW_CONTRAST`:
  - text ≥ 4 % of the frame height: at least **3:1** against what is behind it;
  - smaller text: at least **4.5:1**.
  - Over photos or video, give text a `background` box or a dark `colorOverlay`/`vignette` underneath; the lint can't see images.
- Keep the accent off large areas: a full-frame accent is a transition (color flood), not a ground.
- Same palette for the whole film; a palette change is a chapter change.

## Caju brand (Studio swatches)
| Hex | Name | Role |
|---|---|---|
| `#F6B73C` | caju yellow | accent, highlight box |
| `#F47B35` | caju orange | accent, color flood |
| `#E94B35` | caju red | alerts, strong CTA |
| `#9A5B1F` | caju brown | support, shapes |
| `#171512` | ink | ground |
| `#FFF8E9` | cream | text on ink, light ground |
| `#FFFFFF` | white | sparing highlights |

Pairs that pass: `#FFF8E9` on `#171512` (≈ 17:1), `#171512` on `#F6B73C` (≈ 10:1), `#F6B73C` on `#171512` (≈ 10:1). `#FFFFFF` on `#F47B35` is only ≈ 2.7:1: fails even for large text; use `#171512` on orange. `#E94B35` on `#FFF8E9` is ≈ 3.6:1: large text only.

## Ready palettes
| Name | Ground | Text | Accent | Support | Feel |
|---|---|---|---|---|---|
| Caju dark | `#171512` | `#FFF8E9` | `#F6B73C` | `#F47B35` | warm, confident (default) |
| Caju light | `#FFF8E9` | `#171512` | `#E94B35` | `#9A5B1F` | friendly, editorial |
| Ink & lime | `#101411` | `#F1F4EC` | `#C6F24E` | `#5E6B57` | product, tech without neon |
| Paper & cobalt | `#F4F1EA` | `#1B1F2A` | `#2F5BEA` | `#C9C2B4` | finance, B2B, explainers |
| Night & coral | `#14161C` | `#F2EFEA` | `#FF6B57` | `#3A3F4B` | social, lifestyle |
| Forest | `#0F1D17` | `#EAF2EC` | `#F2B84B` | `#2E5E4A` | sustainability, health |

Text/ground pairs above are all ≥ 14:1; accents on their ground are ≥ 4.5:1 except Caju light (`#E94B35`, 3.6:1: accent words at title size only).

## Where colors go in the document
- Ground: `settings.background` and/or a full-frame `shape` on the `main` track (`locked: true`).
- Text: `props.color`; highlight box: `props.background`.
- Tints and grades: an `effect` clip `colorOverlay` (brand wash at 0.1–0.25) or an `adjustment` clip with `saturate`/`contrast` (caju-authoring → motion.md).
