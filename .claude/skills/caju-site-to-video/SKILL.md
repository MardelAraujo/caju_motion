---
name: caju-site-to-video
description: Workflow to turn a website or product URL into a Caju Motion video - caju capture for real screenshots, brand colors, fonts, copy and images, then a storyboard built from the real material, build and review. Use when the user gives a URL or says "make a video of my site/landing page/product", "promo from our website", "vídeo do meu site".
version: 0.2.0
---

# Website → video

Show the **real site**, not a redrawn imitation: its screenshots, its logo, its words, its colors. Commands assume the repo checkout (`npm run caju -- …`).

## Steps
1. **Brief** (caju-best-practices → [intent-interview.md](../caju-best-practices/intent-interview.md)): usually a 15–30 s promo, `reel-9x16` or `landscape-16x9`. Ask what the viewer should do after watching (the CTA) and whether there is narration.
2. **Create the project folder** (code-first: just `projects/<id>/`; or `caju new <id> --format <format>`).
3. **Capture the site:**
   ```bash
   npm run caju -- capture https://example.com --project <id> [--width 1440] [--height 900]
   ```
   Writes `projects/<id>/assets/capture/`:
   | File | Use it for |
   |---|---|
   | `page.png` (full page) | scrolling reveals, section crops |
   | `viewport.png` | the hero shot, first frame |
   | `tokens.json` | `colors[]` (`hex`, `role: background\|text\|accent`, `count`), `fonts[]` (`family`, `weights`, `role: heading\|body`), `title`, `description` |
   | `text.txt` | the site's own words, headings first: take the headline and claims from here |
   | `images.json` | large images and logo candidates (`src`, `alt`, `width`, `height`) |
4. **Brand tokens → palette and type.** Map `tokens.json` colors by role (background → ground, text → text, accent → the one accent; caju-creative → [palettes.md](../caju-creative/palettes.md)) and check contrast. Fonts: if the site's family isn't bundled, use the closest bundled one (caju-creative → [typography.md](../caju-creative/typography.md)) and tell the user. Save the brand to `.caju/preferences.json` only after approval.
5. **Register the assets** (`p.asset({ id: 'cap-page', kind: 'image', src: 'assets/capture/page.png', meta: { width, height } })`). Fill `meta` with `caju media <id>` or `measureMedia`. Download logo candidates into `assets/images/` only if they are local files the capture saved; never reference URLs.
6. **Storyboard from the real material** (caju-authoring → [storyboard.md](../caju-authoring/storyboard.md)). A typical 20 s arc:
   | Frame | Visual |
   |---|---|
   | Hook | the site's headline from `text.txt`, big type on the brand ground |
   | The product | `viewport.png` in a device-less frame (rounded rect + `dropShadow`), slide in |
   | Features (2–3) | crops of `page.png`: the same image with `y` keyframes scrolling to each section, or scaled 1.6× on the section, one claim each |
   | Proof | a number or quote from `text.txt` (CountUp component if numeric) |
   | CTA | logo + URL, held ≥ 2 s |
7. **Build** with the real screenshots:
   - A long `page.png` scrolls with `transform.y` keyframes (`easeInOut`, 24–40 frames per section) and holds 1.5–2 s on each section.
   - Crop by placing the image larger than the frame and using a `wipe` reveal, or a rounded `shape` behind it as a card.
   - Motion and transitions per [caju-creative](../caju-creative/SKILL.md) (one direction, the site's accent as the only accent).
8. **Review loop:** `caju build` → `caju check` (watch `CAJU_LOW_CONTRAST` with brand colors, `CAJU_TEXT_TOO_SMALL` on scaled screenshots) → `caju snapshot <id> --at-cuts` → look → fix → one question → render (caju-best-practices → [review-loop.md](../caju-best-practices/review-loop.md)).

## Pitfalls
- Rebuilding the site's UI with rectangles: use the screenshots.
- Inventing claims: every on-screen claim comes from `text.txt` or the user.
- Tiny screenshot text: a full-page screenshot at 1080 px wide is unreadable; zoom into the section that matters.
- Logos: prefer an SVG or high-resolution PNG the user sends over a small captured one.
