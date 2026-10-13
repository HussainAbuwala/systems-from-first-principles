# Visual language

Every visual in the series is drawn in one notation: ink on a white board, with a small fixed set of symbols. It shows the system and the measurements, and nothing else. The presenter is on camera; the board sits beside them.

Reference page with live examples: [Unplanned Stack notation](https://claude.ai/artifact/PNb39NpwvcnPBoNDkvrRyX) (boards replay `e04-01` and `e04-02`).

## Rules

1. **Only the subject.** If removing a mark loses nothing, remove it.
2. **Black is now. Grey is before, or context. Red is the limit or the break,** and nothing else.
3. **Things move only when the system moves.** No transitions, no camera moves. Cuts only.
4. **Draw only what has been said.** The board builds up as it is explained.
5. **Once placed, nothing moves.** Later stages add to the board; they never rearrange it.
6. **Every number has a unit and comes from a run.** The run ID, small in a corner, is the only metadata.
7. **No icons, logos, 3D, shadows, gradients, glow, textures or emoji.** A name is the icon.
8. **One typeface family, two styles.** Words in the text face, numbers and code in its mono.

## Symbols

| Symbol | Meaning |
| --- | --- |
| Named box | A running program (nginx, Node, Litestream). The name is the icon. |
| Dashed outline | A machine. Its spec and price are written once, on the outline. |
| Arrow | A request or a copy, pointing the way the data goes. |
| Dot | One unit of work: a request, a write, a job. |
| Dots piling up in front of a box | A queue. |
| Bar, 0–100% | A resource being used up (CPU, memory, disk). Red when full. |
| Line over time | A measurement from a run. A dashed red line is the limit from the event script; the part above it is red. |
| Number + unit | A measured value, set in the mono. |
| Two lifelines, slanted arrows | A sequence diagram: time runs down, each arrow is a message crossing the network. |
| Grey vs black | Before (or unchanged) vs now (or changed). A stage diff greys out what did not change. |
| ✓ / ✗ | An event passed or failed. The only two marks. |

Layout: left to right is the path a request takes; top to bottom is time. Size never encodes anything outside a chart.

## Colour and type

| Token | Value | Use |
| --- | --- | --- |
| Board | `#ffffff` | Background, always white |
| Ink | `#111111` | Everything that is now |
| Grey | `#9a9a9a` | Before, unchanged, axis labels, run IDs |
| Red | `#d1291f` | Limits and whatever crossed them, nothing else |

Typeface: **IBM Plex Sans** for words, **IBM Plex Mono** for numbers, units and code (both SIL Open Font License). Chosen on 2026-10-08 over Plex Serif, Routed Gothic + Commit Mono, Atkinson Hyperlegible, Concrete and Computer Modern.

## Recurring boards

- **The break:** the stage's system, live dots from the run, the saturated resource and the p99 line crossing the limit in the same frame.
- **The diff:** the next stage on the same layout; only what changed is black, the previous run stays on the chart in grey.
- **The why:** a sequence diagram with the expensive step in red and the measured cost beside it.
- **The scoreboard:** one row per stage; earlier stages grey, the current one black.
