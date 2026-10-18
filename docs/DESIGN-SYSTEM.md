# Sarhad — Design system

A chunky cartoon game UI in white and red: thick ink outlines, 3D pill buttons, hard offset shadows, and a few small pixel-art accents. **Red means your route**: endpoints, connected states and the main button. Errors are never red.

Tokens live as CSS variables in `src/index.css` (`@theme`). Tailwind utilities such as `bg-red`, `text-muted` and `border-ink` exist. Component classes (`.panel`, `.btn`, `.btn-2`, `.btn-icon`, `.err-pill`, `.sticker`, `.pixel`) are in `@layer components`, so utilities can still override them.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| White | `#FFFFFF` | background, panels, secondary button face, label halo |
| Ink | `#1E1B2E` | outlines (3 px on panels/buttons, 1.5 px on regions), text, stitch, hard shadows |
| Muted | `#5B5870` | secondary text, outline of unconnected guesses |
| Red | `#DC2626` | primary button face, endpoints, connected regions and chips, stickers |
| Red-hi | `#F25A4A` | button and sticker highlight band, pixel-art highlights |
| Red-lip | `#991B1B` | button and sticker lip, revealed shortest route |
| Land | `#EEF0F4` | unguessed region fill, empty pixel-bar cells |
| Border | `#C7CBD6` | region borders, secondary/icon button lip, input rest shadow |
| Slate | `#7D8496` + diagonal white hatch | guessed but not yet connected |
| Mist | `#F1F2F5` | error pill background |

No soft shadows and no blur. The only gradient-like element is the highlight band on buttons and stickers.

### Contrast (WCAG 2.x, computed)

Text pairs need ≥ 4.5:1; UI elements and region fills ≥ 3:1.

| Pair | Ratio | Use | Result |
| --- | --- | --- | --- |
| White on Red | 4.83 | button labels (also outlined in ink), connected chips, sticker letters, labels on red regions | pass |
| Ink on White | 16.78 | body text, outlines | pass |
| Muted on White | 6.83 | secondary text | pass |
| Ink on Mist | 14.99 | error pill text | pass |
| Ink on Land | 14.71 | map labels (on a white halo anyway) | pass |
| Red on White | 4.83 | the ⋯⋯ in the pair, focus ring | pass |
| Red vs Land | 4.23 | endpoint/connected fill vs unguessed land | pass |
| Ink vs Land | 14.71 | 1.5 px outline of red regions | pass |
| Muted vs Land | 5.99 | 1.5 px outline of unconnected guesses | pass |
| Ink vs Red | 3.47 | outline of red regions and buttons | pass (UI) |
| Slate vs Land | 3.28 | unconnected-guess fill vs unguessed land | pass |
| White on Slate | 3.74 | the hatch stripes | decorative (pattern on a fill that already passes) |
| Border vs Land | 1.42 | region boundaries | decorative (land vs land); not a control |
| White on Red-hi | 3.31 | the top of button labels crosses the button band (sticker letters sit below their band) | the ink text outline (Ink on Red-hi 5.06) carries the letter edge |

Colour is never the only signal:
- **Connected:** ● plus red fill plus ink outline.
- **Not connected:** ○ plus hatch plus muted outline.
- **Error:** ✗ plus a shake plus a grey pill.

## Type

- **Silkscreen Bold** (pixel font) for the wordmark and the CONNECTED! / GAME OVER stickers only:
  - Self-hosted from `@fontsource/silkscreen` (weight 700), subset to space, `!`, 0–9 and A–Z.
  - The subset is 1 KB; Vite inlines it into the CSS, so it adds no request.
  - Regenerate with `npm run font:wordmark` (needs Python fontTools).
- **Lilita One:**
  - Self-hosted via `@fontsource/lilita-one`, Latin subset, weight 400, `font-display: swap`, 10.7 KB WOFF2.
  - Used for buttons, headings, the state pair, the timer and scores.
  - It has one weight, so `.font-display` sets `font-synthesis: none` and the browser never fakes a bold.
- **System UI** for small body text. Devanagari falls back to the phone's system font.
- Buttons, stickers and small labels are in caps (`text-transform`, so the DOM text and accessible names stay in normal case). State names stay in normal case.
- Timer, scores and counts use `tabular-nums` (`.num`).
- **Map labels:** 12 px bold system font.
  - On red regions: white text with an ink halo.
  - Everywhere else (land, leaders, tooltips): ink text with a white halo.

## Shapes

- **Panel:** white, 3 px ink outline, radius 18 px, hard shadow `0 4px 0 ink`.
- **Primary button (`.btn`):**
  - Pill, 3 px ink border, red face.
  - Inset highlight band: Red-hi, top 40%, inset 12 px.
  - Lip: `box-shadow: 0 6px 0 #991B1B, 0 6px 0 3px ink`.
  - Label: Lilita One, white, with a 2 px ink outline drawn by eight text-shadows.
  - Minimum height 52 px. Pressed: `translateY(4px)` and the lip shrinks to 2 px (80 ms).
- **Secondary button (`.btn-2`):** white face, ink text, same outline, Border-coloured lip, no band.
- **Icon button (`.btn-icon`):** 48 px round secondary button with a 4 px lip. The Enter button is the red variant.
- **Input:** 3 px ink border, radius 18 px, 52 px tall. A soft Border shadow at rest becomes an ink shadow on focus; there's no red ring, since red means route.
- **Chips:** pill, 2 px ink border. Connected: red with white text and ●. Not connected: white with ○.
- **Error pill:** Mist background, ink text, a ✗ drawn with `::before` (alt text `""`, so it isn't read out or included in `textContent`).
- **Sticker (`.sticker`):** used for the wordmark and the result badges. It is level, never rotated, and looks embossed:
  - **Face:** red, 3 px ink border, radius 0.28em.
  - **Inner bevel:** `inset 0 2px 0 rgb(255 255 255 / .35), inset 0 -3px 0 rgb(0 0 0 / .18)`.
  - **Lip and outline:** `0 0.14em 0 Red-lip, 0 0.14em 0 3px ink`.
  - **Highlight band:** the top 30%, Red-hi blended 70% into Red, fading out over its last 2 px, so it ends above the letters.
  - **Letters:** Silkscreen, white, raised with a stacked extrusion and no blur: `0 1px 0 #FFD9D4, 0 2px 0 Red-lip, 0 3px 0 ink`. Letter-spacing 0.05em.
  - **Size:** 22 px, capped at 6.9vw on Home and 6.6vw on Result so it fits at 320 px. On Home the sticker is 32 px tall, against the 30 px streak/points row. The Home header wraps at large text sizes.
- **Touch targets:** at least 48 px.

## Pixel accents (`src/components/pixel.tsx`)

All are inline SVG on a pixel grid with `shape-rendering: crispEdges`; no images, no icon font.

- **Guesses-left bar:** ink frame with 20 red cells (each with a Red-hi top row) that drain from the right as guesses are spent, plus the number left.
- **Flame** next to the streak on Home and Result; **coin** next to total points on Home.
- **Hearts** on Result: guesses left out of 20, in two rows of 10. Filled means left, matching the guesses-left bar.

## App icon

The sticker with a pixel "S", drawn on a 16×16 grid, so the favicon is pixel-exact at 16 px and scales up crisply. `npm run icons` (`scripts/build-icons.ts`) writes these files and renders the PNGs with Playwright's Chromium:
- `public/icon.svg`
- `icon-192.png`, `icon-512.png`
- `icon-maskable-512.png` (white bleed, sprite inside the 80% safe zone)
- `apple-touch-icon.png`
- `favicon-32.png`

## The stitch (signature)

The stitch is an ink dashed thread, 2.5 px with round caps, dash 6 and gap 5, on a white casing 2 px wider on each side, so it reads on red.
- When a guess connects, a thread draws from it to each connected neighbour (350 ms).
- On a win, one white pulse runs along the route (600 ms) and the endpoints glow once in ink.
- On Result, a shortest route you didn't find is drawn in Red-lip.

## Motion and haptics

150–350 ms, ease-out. With `prefers-reduced-motion`, only colours change: no pops, shakes, pulses, "+1" or button travel.

| Event | Motion | Haptic (`navigator.vibrate`) |
| --- | --- | --- |
| Connected guess | fill fades to red (220 ms), 1.06 → 1 pop, the stitch draws, a small ink "+1" bounces up beside the region (700 ms) | 15 ms |
| Accepted, not connected | fill fades to hatched Slate (180 ms) | 10 ms |
| Late link | regions turn red in chain order, 60 ms apart; their stitches follow | — |
| Rejected (unknown, endpoint, not playable, partial name) | input shakes ±6 px ×3 (240 ms), grey ✗ pill slides in | 30-40-30 |
| Duplicate | same shake + pulse on that state's chip | 30-40-30 |
| Win | pulse along the route, endpoint glow, "CONNECTED!" sticker, points count up (800 ms). No confetti. | 20-60-20-60-80 |
| Button press | 4 px travel, lip 6 → 2 px (80 ms) | — |

Haptics are feature-detected (a no-op on iOS) and can be switched off on Home (saved per device, default on).

## Copy budget

- **Home:** at most ~12 words besides names and numbers.
- **Ready:** '? ⋯⋯ ?', START, and 'Clock starts when you tap.'
- **Game:** the pair, the timer, the pixel guesses bar, and one hint line in the first game only.
- **First open:** a 3-frame coach, reopened with '?':
  1. 'Two states. Join them by land.'
  2. 'Type the states between. Any order.'
  3. 'Faster = more points.'
- **Result:** the sticker ('Connected!' or 'Game over'), plus 'Out of guesses' or 'You gave up' on a loss.
- **Home buttons:**
  - There is only ever one practice button: 'Continue practice' while one is in progress, otherwise 'Practice'.
  - Before today's daily is done, the red button is Play or Continue.
  - Once it's done, the red button is 'Leaderboard' in server builds, and Practice becomes the white button.
  - Offline builds make Practice the red button instead.
