# Sarhad — Design system

One quiet surface, one warm accent, one decorative element: the **stitch**. Everything else stays out of the way of a one-minute daily game.

Tokens live as CSS variables in `src/index.css` (`@theme`, so Tailwind utilities such as `bg-ink`, `text-ink-soft`, `bg-marigold` exist).

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| Ink (neel indigo) | `#22306B` | text, headings, primary button fill |
| Ink-soft *(derived)* | `#57628F` | secondary text (Ink mixed 75% with Paper) |
| Ink-line *(derived)* | `#767FA4` | input and chip outlines, unconnected-region outline (Ink 60% on Paper) |
| Paper | `#F5F6FA` | app background, label halo, text on Ink |
| Land | `#E3E6F0` | unguessed region fill |
| Border | `#AAB2CC` | region boundaries, 1 px |
| Marigold | `#F4A10C` | endpoints, connected guesses, the stitch |
| Marigold-deep | `#C46A00` | outlines of marigold regions, focus ring, the ⋯⋯ in the pair |
| Slate | `#8E97AE` + diagonal hatch | accepted but not yet connected guesses |
| Kumkum | `#B3261E` | rejection message text only |

Text on Marigold is always Ink. No shadows, no gradients.

### Contrast (WCAG 2.x, computed)

Text pairs need ≥ 4.5:1; UI elements ≥ 3:1.

| Pair | Ratio | Use | Result |
| --- | --- | --- | --- |
| Ink on Paper | 11.42 | body text | pass |
| Ink on white | 12.33 | text on cards | pass |
| Paper on Ink | 11.42 | primary button label | pass |
| Ink on Marigold | 5.84 | connected chips, completion chip | pass |
| Ink on Land | 9.89 | text over the map | pass |
| Ink-soft on Paper | 5.48 | secondary text | pass |
| Kumkum on Paper | 6.05 | rejection message | pass |
| Ink-line on Paper | 3.64 | input border, unconnected chip outline (UI) | pass |
| Marigold-deep on Paper | 3.60 | focus ring (UI) | pass |
| Marigold-deep on Land | 3.11 | outline of connected regions against unguessed land (UI) | pass |
| Ink-line on Land | 3.17 | outline of unconnected regions against land (UI) | pass |
| Ink on Slate | 4.22 | — never used directly: map labels sit on a Paper halo (11.42) | n/a |
| Marigold on Land | 1.69 | region fill only | fill is decorative; the 3.11 outline + ● carries the state |
| Slate on Land | 2.34 | region fill only | the hatch + 3.17 outline + ○ carry the state |
| Border on Land | 1.69 | region boundaries | decorative (land vs land); not a control |

Colour is never the only signal: connected = ● + marigold + deep outline; not connected = ○ + hatch.

## Type

- **Baloo 2** (self-hosted via `@fontsource/baloo-2`, Latin subset only, weights 600 and 800, `font-display: swap`): wordmark, the state pair, big numbers, buttons. ~38 KB of WOFF2.
- **System UI** for everything else. Devanagari falls back to the phone's system font; no Devanagari download.
- Timer, scores and counts use `font-variant-numeric: tabular-nums` (`.num`).
- Map labels: 12 px Ink, bold, with a 2 px Paper halo (`paint-order: stroke`).

## Shape and touch

- Radius 14 px on cards, buttons and inputs; 999 px on chips.
- Touch targets ≥ 48 px (icon buttons are a fixed 48 px so they don't balloon at 200% text).

## Map labels

- Only the two endpoints (always) and the latest guess are labelled; a tap on any guessed region shows its name for 2 s.
- Collision check, priority **tapped > endpoint > latest guess**; a lower-priority label that overlaps is hidden (`src/lib/labels.ts`, tested).
- Small regions (DL, CH, GA, TR, DD, SK): a dot marker and a short leader line to a label placed outside the cluster (into the sea or blank space where possible), plus a larger invisible hit area.

## The stitch (signature)

A dashed running thread, Marigold 2.5 px, round caps, dash 6 / gap 5, on a thin Paper casing so it reads on marigold fills. When a guess connects, a thread draws from its label point to each connected neighbour already on the board (stroke-dashoffset through a mask, 350 ms). On a win, one pulse runs along the route (600 ms). It is the only decorative element.

## Motion and haptics

150–350 ms, ease-out. With `prefers-reduced-motion`, only colours change; nothing moves.

| Event | Motion | Haptic (`navigator.vibrate`) |
| --- | --- | --- |
| Connected guess | fill fades to Marigold (220 ms), 1.06 → 1 pop at its label point, then the stitch | 15 ms |
| Accepted, not connected | fill fades to hatched Slate (180 ms), no pop | 10 ms |
| Late link | regions turn Marigold in chain order, 60 ms apart; their stitches follow | — |
| Rejected (unknown, endpoint, not playable) | input shakes ±6 px ×3 (240 ms), message slides in | 30-40-30 |
| Duplicate | same shake + pulse on that state's chip | 30-40-30 |
| Win | one pulse along the route, endpoints glow once, points count up (800 ms). No confetti. | 20-60-20-60-80 |

Haptics are feature-detected (a no-op on iOS) and can be switched off on Home (saved per device, default on).

## Copy budget

Home carries at most ~12 words besides names and numbers. Ready: '? ⋯⋯ ?', Start, 'Clock starts when you tap.' Game: the pair, the timer, a 20-segment guess bar; one hint line in the first game only. First open: a 3-frame coach ('Two states. Join them by land.' / 'Type the states between. Any order.' / 'Faster = more points.'), reopened with '?'.
