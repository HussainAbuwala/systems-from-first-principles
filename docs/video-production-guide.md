# Video production guide

Use this as the short preflight for future **Systems from First Principles** episodes. Pick and approve the topic first with the [episode selection criteria](episode-selection.md).

## Story

- Never start with the answer. Build the system from scratch, piece by piece, and add each component only because the previous design visibly failed. Weave in the company's documented failures as the build reaches them.
- Start with the real user-visible problem and show it happening.
- Build in this order: **simple solution → visible failure → smallest useful fix**.
- Define a term only when the audience has seen why it is needed. Always explain what it is for and when it matters.
- Connect every section to the previous failure. Remove technically interesting material that does not advance the central question.
- Keep one authoritative recording script aligned line-by-line with the final scenes.

## Visual language

- Prefer the hand-drawn notebook world, live diagrams, cursors, packets, and state changes over lecture slides.
- Give each idea its own frame. Avoid overlapping cards, labels, and diagrams.
- Match narration literally: if the voice says **position**, do not animate **fill**.
- Make the visual event happen just before or as it is spoken—not several seconds later.
- Open with a product-like demonstration; end by zooming out to the complete system map and highlighting each learned component.

## Voice and sound

- Record in short takes, but preserve natural breaths and connective sentences.
- Trim dead air and use gentle fades so take boundaries do not sound like audio switching off and on.
- Keep music clearly present but below speech; check headphones and laptop speakers.
- Review the full edit once without reading the script to catch robotic pacing.

## Mistakes not to repeat

- Do not introduce CRDTs or another alternative architecture without first explaining its purpose; omit it if it distracts from the documented system.
- Avoid unexplained operational phrases such as “a deployment closes processes.” Describe the concrete event and consequence.
- Do not imply checkpoints save a separate full document after every edit. Distinguish periodic snapshots from the incremental journal.
- Check animation timing against the actual recorded voice, especially crashes, reconnects, journal writes, and early property changes.

## Delivery

- Long form: 1920×1080, 24 fps, H.264 High Profile, `yuv420p`, BT.709 limited range, AAC at 48 kHz.
- Short: 1080×1920 with readable text inside mobile-safe margins.
- Upload privately and wait until YouTube explicitly offers 1080p before publishing.
- Use a notebook-style thumbnail with a short promise and one meaningful diagram.
