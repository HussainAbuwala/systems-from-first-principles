# Episode 2 — Two buyers, one last pair

**Status:** Story, theory and presentation revised; ready for a rehearsal pass.

**Promise:** Build a store from scratch, then earn each change by showing the failure it addresses. Use Shopify’s published experience as checkpoints, not as an answer revealed at the start or a reconstructed company timeline.

## Start here

- [Presenter view](canvas/presenter.html) — open this self-contained file in a browser. No install or network required. **Space / Right** reveals the question, then advances. **N** toggles narration; **R** gives a clean recording view; **Esc** restores controls.
- [Editable Excalidraw canvas](canvas/two-buyers-one-last-pair.excalidraw) — 15 main frames plus 3 optional technical frames. Open in Excalidraw or its editor extension. Frame names match the script. This version shows all text; present one frame at a time and reserve the full zoom-out for the ending.
- [Recording script](scripts/recording-script.md) — spoken copy and pointing cues, aligned to every frame. Allow roughly 10–12 minutes including pauses.
- [Theory guide](theory.md) — reasoning, technical boundaries and answers to likely questions.
- [Evidence notes](research/evidence-map.md) — verified company claims and mechanism references.
- [Review notes](research/review-notes.md) — substantive corrections from the first draft.

The canvas uses simple editable shapes with consistent buyer colors: Alice blue, Bob orange. The browser presenter uses the same positions and wording with smooth SVG outlines; Excalidraw adds its rough drawing style. The appendix sits below the main route so it does not interrupt the story.

## The build

One quantity → two shoppers race → atomic stock decision → payment can fail → durable hold → flash-sale contention → Redis experiment → split-write crash → separate unit rows → skip busy candidates → inventory transactions → bounded pool → shared-connection bottleneck → gradual replacement.

At each step, explain what works before exposing the next constraint. The atomic-counter design is valid at modest load; Redis is a plausible branch, not a mandatory stage; the row-pool approach is not a universal final answer.

## Editing

[build_canvas.py](canvas/build_canvas.py) is the source for frame content, narration and visual positions. Regenerate the Excalidraw file, presenter HTML and script together:

```sh
python3 episodes/shopify-inventory-reservations/canvas/build_canvas.py
```

Direct Excalidraw edits are possible, but regeneration will overwrite them. Keep a separately named copy if making manual layout changes.
