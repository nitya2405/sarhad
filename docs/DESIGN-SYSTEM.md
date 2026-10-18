# Sarhad — Design system

A chunky cartoon game UI in white and red: thick ink outlines, 3D pill buttons, hard offset shadows, and a few small pixel-art accents. **Red means your route**: endpoints, connected states and the main button. Errors are never red.

Tokens live as CSS variables in `src/index.css` (`@theme`). Tailwind utilities such as `bg-red`, `text-muted` and `border-ink` exist. Component classes (`.panel`, `.btn`, `.btn-2`, `.btn-icon`, `.err-pill`, `.sticker`, `.pixel`) are in `@layer components`, so utilities can still override them.

## Frame

- **Column:** the whole app is one phone-width column: `#root`, centred, at most 440 px wide and full height, clipping anything wider.
- **Outside the column** on wide screens: the same drifting red gradient on Home and `#F5F6FA` on every other screen (`body[data-screen]`).
- **Overlays:** every overlay (coach, result backdrop and card, map view) is positioned inside the column (`absolute`), never on the browser window.
- **Test:** `e2e/layout.spec.ts` checks at 1440×900 that `#root` is ≤ 440 px and that no element sits outside it.

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

### Home on the red gradient

The gradient runs `#F25A4A → #DC2626 → #B91C1C` from top to bottom (stops at 0%, 35% and 68%), so the darkest red sits under the only small text drawn straight on it. Ratios were measured from screenshots at 360×740 and 320×640, with the drift paused at both ends of its loop.

| Pair | Ratio | Use | Result |
| --- | --- | --- | --- |
| White 85% on `#B91C1C` (measured behind the credit, all four cases) | 5.00 | footer map credit | pass |
| White on `#B91C1C` | 6.47 | 'Continue the {date} daily' link (bottom) | pass |
| White 85% on `#F25A4A` (lightest point) | 2.78 | **nothing**: the top of the screen holds only white-faced parts (pill, sticker, icon buttons) | n/a (would fail; kept clear of text) |
| White on `#F25A4A` (lightest point) | 3.31 | white surfaces' edges against the lightest red; each has a 3 px ink outline | pass (UI ≥ 3) |
| Ink vs `#F25A4A` | 5.06 | outlines and lips of white parts at the top | pass |
| Red on White | 4.83 | primary button text (Daily / Leaderboard), the inverted SARHAD letters | pass |
| White on Ink | 16.78 | secondary button text (Practice, My stats) | pass |

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
- **Map pins** (7×9) in the Home hero: ink outline, white fill, red dot.

## Home hero (`src/components/Hero.tsx`)

- **Scene:** India from the bundled minimap, filled white at 90% with soft red borders (`#F3B4B0`), two pins and an ink route line between them (dash 7/6, round caps).
- **Pins:** on the real label points of Gujarat and Assam from `map.json`. Each pin is a white teardrop with an ink outline and a solid red dot, about 16 px tall at any width, and its tip sits exactly on the point.
  - They are fixed decoration and never mark the day's pair.
- **Route:** a smooth curve (Catmull-Rom through waypoints) that stays over Indian land, threading the Siliguri corridor north of Bangladesh.
- **Test:** `Hero.test.ts` checks each pin with point-in-polygon on the map data and samples the whole route (1,000 points per segment).
- **Motion:** none, except that the route draws in once on load (600 ms). With reduced motion it is simply there.

## Home background

- **Gradient:** a full-screen red ombre on one fixed, oversized `::before` on the page.
- **Drift:** a 20 s alternating loop of `translate3d` plus a 2° rotate. It uses transform only, so it runs on the compositor with no `background-position` repaints. It measured 60 fps under 4× CPU throttling (241 frames in 4 s, worst frame 17 ms).
- **Reduced motion:** the gradient is static.
- **Column:** one shared drifting layer (`body[data-screen="home"]::before`) sits behind the page, and the column is transparent on Home, so inside and outside match with no seam.
- **Pieces on red:**
  - **SARHAD sticker:** inverted (`.sticker-inv`): white face, red Silkscreen letters on an ink extrusion, ink border and lip.
  - **Primary button (`.btn-light`):** white face, red Lilita text, ink lip. Used for Daily, or Leaderboard once the daily is done.
  - **Secondary button (`.btn-dark`):** ink face, white text, darker lip. Used for Practice and My stats.
  - **Other parts:** white corner icon buttons and a white streak/points pill with an ink outline. The footer credit is white at 85%.

## Game map

- **Layout:** header and guesses bar at the top, then the map, the guess-chip row and the input. An empty chip row reads 'Your guesses show here'.
- **Map panel:** the map sits in a framed panel that fills all remaining height: 16 px side gutters, 2 px ink border, radius 18 px, white, overflow hidden.
  - Its size is measured with a ResizeObserver, and the zoom is fitted to its real aspect ratio (`xMidYMid meet`), recomputed on resize.
- **Auto-zoom:** the view is the bounding box of the start, end and every guess, plus 18% padding.
  - It is fitted to the container's aspect ratio and never narrower than 35% of India's width.
  - If the padded view would reach past India, or would barely zoom (wider than 80% of India), all of India is shown with a 3% margin instead.
  - A zoomed view is kept inside the map with the same 3% margin, so a coast is never flush with the frame. Land is only cut at the frame when the view is really zoomed in.
  - **Test:** at 360×740 and 320×640, for 10 seeded-random puzzles plus Himachal→Karnataka and Jharkhand→Mizoram, both endpoint regions sit fully inside the panel at the start view.
  - View changes animate over 300 ms; with reduced motion they are instant.
- **Inset:** a 64 px full-India thumbnail in the panel's top-right corner, inside the frame, with an ink outline and a red rectangle showing the current view. It shows only while zoomed in.
  - It moves to top-left if it would cover an endpoint, and hides if both corners would. The same test checks that it never covers one.
- **Labels never clip:** each label box is clamped inside the view. If the name is still too wide it splits onto two lines ('Arunachal / Pradesh'), then falls back to its first word.

## App icon

The sticker with a pixel "S", drawn on a 16×16 grid, so the favicon is pixel-exact at 16 px and scales up crisply. `npm run icons` (`scripts/build-icons.ts`) writes these files and renders the PNGs with Playwright's Chromium:
- `public/icon.svg`
- `icon-192.png`, `icon-512.png`
- `icon-maskable-512.png` (white bleed, sprite inside the 80% safe zone)
- `apple-touch-icon.png`
- `favicon-32.png`

## The stitch (signature)

The stitch is an ink dashed thread, 2.5 px with round caps, dash 6 and gap 5, on a white casing 2 px wider on each side, so it reads on red.
- **Spanning tree:** stitches follow a spanning tree of the connected regions. Breadth-first from the start (then from the end), each region joins the one already-joined neighbour that reached it first.
  - Threads only ever join states that share a land border, with no triangles or zigzags.
  - When a guess connects, its thread draws in (350 ms).
- **Win:** one white pulse runs along the route (600 ms) and the endpoints glow once in ink.
- **One shortest route on Result:** a separate thinner ink line with long dashes (11/6), shown in map view only.
  - It is drawn only when you didn't find a shortest route, and only after a tap on "Show shortest route". It is hidden by default, so a loss leaves the map clean.

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

Haptics are feature-detected and can be switched off on Home (saved per device, default on). Where `navigator.vibrate` is missing (iPhone/iOS) the toggle is not shown at all; Android keeps it.

## Copy budget

- **Home:** a one-screen game menu; it never scrolls at 360×740 or 320×640, but may at 200% text.
  - **Corners:** vibration toggle top-left; streak and points top-right; '?' bottom-left; map credit bottom-right.
  - **Centre:** the inverted SARHAD sticker at about twice header size, the hero, then three buttons: daily (white primary), Practice (ink), Leaderboard (ink; 'My stats' offline).
  - **Daily button:**
    - Not played: 'PLAY DAILY' with the date under it.
    - In progress: 'CONTINUE DAILY'.
    - Done: a white panel reading 'Done ✓ 2:51 · 240 pts', or 'Out of guesses' / 'You gave up', plus 'Next in …'. It opens the result.
- **Ready:** '? ⋯⋯ ?', START, and 'Clock starts when you tap.'
- **Game:** the pair, the timer, the pixel guesses bar, and one hint line in the first game only.
- **First open:** a 3-frame coach, reopened with '?'. Each frame has one small picture, big Lilita text, one Next button (Play on the last frame) and Skip at the top right:
  1. 'Two states light up.' / 'Join them by land.'
  2. 'Type a state in between.' / 'Any order. Any path.'
  3. 'Be fast. More points.' / '20 tries.'
- **Result (a pop-up over the map):**
  - **Behind the card:** the final map at full colour, filling the column and zoomed to the route, under white at 55% with a 2 px blur. The card stands out and the route shows through, with no dark overlay.
  - **Card:** centred, at most 340 px wide, popping in from 0.85 to 1 with a slight overshoot (280 ms; a fade with reduced motion). Top to bottom:
    - the CONNECTED! or GAME OVER sticker
    - 'You got it!', 'Out of guesses' or 'You gave up'
    - the pair
    - the three stat tiles (a loss shows '—' for time)
    - 'Shortest route ✓' or 'Shortest: 3 states'
    - the buttons: LEADERBOARD (or MY STATS offline) + HOME for a daily; PLAY AGAIN + HOME for practice
    - a 'See map' link
    - for dailies, the streak line and 'Next in', small
    - the map credit
  - **Flagged win:** one small muted line, 'Under review: very fast finish'. The leaderboard shows the player's own time as 'under review' in place of a rank.
  - **See map:** closes the card to inspect the route. A RESULTS button brings it back, and 'Show shortest route' lives only in this view.
  - **Display name:** the prompt moved to the Leaderboard screen.
- **Home buttons:**
  - There is only ever one practice button: 'Continue practice' while one is in progress, otherwise 'Practice'.
  - Before today's daily is done, the daily button is the primary (white) one.
  - Once it's done, Leaderboard becomes the primary button in server builds; offline builds make Practice primary instead.
  - An unfinished daily from another day shows a small 'Continue the {date} daily' link.
  - On iOS Safari outside the installed app, a one-line white tip sits above the buttons: 'Add to Home Screen to keep your streak.'. It has a ✕, and dismissal is remembered per device.
