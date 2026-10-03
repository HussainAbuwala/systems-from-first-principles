# YouTube Short: Who wins this Figma edit?

**Format:** 9:16 vertical
**Target length:** 48–52 seconds
**Delivery:** Curious, quick, and conversational. Let the questions breathe; do not rush the technical rule.

## Recording script

Two people edit the same Figma shape at almost the same time.

Alice moves it. Bob changes its color. Easy—keep both.

But what if Alice changes the fill to green while Bob changes that same fill to red? Who wins?

Both edits travel over WebSockets, but network delay can make them arrive in different orders. So WebSockets make the app real-time—not collaborative.

Figma's documented model adds one authority for the document. It validates each change, accepts them in a single order, and resolves conflicts at the property level.

Different properties? Keep both. Same property? The last value accepted by the server becomes shared.

Now everyone can agree. But agreement is only one-third of the system.

How does Figma feel instant, work offline, and survive a crash?

The full system is linked below.

## Recording notes

- Record this as one continuous take.
- Leave roughly one second of room tone before and after speaking.
- Emphasize **“Who wins?”**, **“not collaborative”**, and **“only one-third.”**
- Target a natural pace around 145–155 words per minute.
- Save the chosen WAV as `animation/public/audio/shorts/figma-who-wins.wav`.

## Visual beats

| Time | Visual |
|---|---|
| 0:00–0:03 | Figma-like canvas; two cursors approach one shape. |
| 0:03–0:11 | Alice moves the shape; Bob changes the fill; both changes survive. |
| 0:11–0:19 | Alice chooses green and Bob chooses red for the same property. |
| 0:19–0:28 | WebSocket packets cross and arrive in different orders. |
| 0:28–0:38 | One document authority accepts `#43 green`, then `#44 red`. |
| 0:38–0:45 | Property-level rule: different properties keep both; same property follows accepted order. |
| 0:45–0:51 | Zoom out: agreement is solved, but instant UI, offline work, and crash recovery remain unanswered. |
