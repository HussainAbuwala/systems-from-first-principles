# Episode outline: Figma multiplayer

## Working title

**How Figma Multiplayer Evolved: From Overwritten Files to Real-Time Collaboration**

## Alternate titles

- Two People Edit the Same Figma File. Who Wins?
- How Figma Keeps Everyone on the Same Page
- From Save Conflicts to Multiplayer: Designing Figma's Collaboration System

## Thumbnail concept

Two cursors pull the same rectangle in opposite directions. Between them, a large warning reads **WHO WINS?** Keep architecture boxes out of the thumbnail.

## Target

- **Length:** 12–14 minutes
- **Audience:** software engineers preparing for system-design interviews and technically curious developers
- **Assumed knowledge:** HTTP requests and databases; WebSockets and distributed-systems terminology are introduced visually

## Viewer promise

By the end, the viewer should be able to explain:

1. Why replacing an entire document fails for simultaneous editors.
2. Why real-time transport alone does not solve concurrent editing.
3. How an authoritative server and property-level conflict resolution simplify convergence.
4. Why optimistic updates are necessary for responsive interaction.
5. How checkpoints and an incremental journal address different durability needs.

## Narrative rule

Never introduce a mechanism before the viewer has seen the failure it solves. Keep the current diagram on screen and add or change only one idea at a time.

## Timed structure

### 00:00–00:30 — Cold open: Who wins?

Alice moves a rectangle left while Bob changes its color. Both screens update instantly. Then both change the color at nearly the same time.

Ask: How can two browsers, separated by an unreliable network, end with the same document without making the editor feel slow?

### 00:30–01:05 — Scope and evidence contract

Promise to build the design from the simplest possible version. Briefly explain that the episode reconstructs dated public descriptions from Figma and labels teaching simplifications separately.

### 01:05–02:15 — Level 0: Save the whole document

Start with one client downloading a file, editing locally, and periodically uploading the full file. It is easy to implement and adequate for one editor.

Add Bob. Both download version 1. Alice uploads version 2A; Bob then uploads version 2B based on the old state. Alice's change disappears.

This is not hypothetical: Figma described this as its original saving model and documented overwrite and stale-version problems. Evidence: F01, F02.

### 02:15–03:20 — Level 1: Send changes, not snapshots

Replace periodic full uploads with a persistent WebSocket. Send small edit operations while the document remains open.

This improves propagation speed and payload size, but deliberately show two edit packets crossing in flight. Transport moved the conflict; it did not resolve it.

### 03:20–04:30 — Level 2: One authority orders changes

Introduce one authoritative Multiplayer instance for the document. Every accepted change passes through it and receives an order.

Show why this is simpler than having browsers independently decide which event happened first. Evidence: F03, F05.

### 04:30–05:00 — Level 3: Define exactly what conflicts

First, Alice moves a rectangle while Bob changes its color. Preserve both edits because they touch different properties.

Next, both change the fill property. The server's latest accepted value wins. Because the server defines the accepted event order, clients do not need synchronized clocks to determine which update is later. Evidence: F05, F06.

Mention the deliberate limitation: character-by-character concurrent editing of a single text value is not merged by this property-level rule.

### 05:00–06:10 — Level 4: Make local edits feel immediate

Demonstrate the bad version: Alice drags an object, but the object moves only after a network round trip. Increase simulated latency and make the lag obvious.

Then apply the edit locally immediately and mark it pending. When the server acknowledges it, change the pending visual state to confirmed.

Introduce the flicker problem with one consistent position example: confirmed `x=100`, pending local `x=200`, then an older server `x=130`. Contrast a naive client that visibly jumps `100 → 200 → 130 → 200` with a corrected client that remembers 130 underneath while keeping pending 200 visible until acknowledgement. Clarify that suppression is temporary; a rejection or later winning server update still changes the display. Evidence: F07.

### 06:10–07:10 — Level 5: Disconnect and reconnect

Take Bob offline. He continues editing. Alice changes the online copy. On reconnection, Bob downloads fresh state, reapplies his offline edits, and resumes synchronization.

Clarify that convergence does not mean every human intention is preserved; conflicts still follow the system's resolution rules. Evidence: F04.

### 07:10–08:15 — Level 6: The fast state is volatile

Zoom out from conflict resolution to durability. The Multiplayer instance holds the active file in memory for speed and periodically writes a complete compressed checkpoint to S3.

Crash the process just before its next checkpoint. The latest accepted edits disappear during recovery. Figma's checkpoint interval was described as 30–60 seconds, so the older design could lose up to roughly 60 seconds of server-side work. Evidence: F10, F11.

As a clearly labeled proposed model, ask whether the same checkpoint could be overwritten after every edit. State that the cited public material does not establish Figma's snapshot-retention layout. Clarify that the hypothetical design can retain one snapshot but still performs one complete encode, compression, transfer, and write per edit. Coalescing several edits into one overwrite reduces work but recreates the checkpoint gap. Use this tradeoff to motivate incremental durability.

### 08:15–09:45 — Level 7: Add an incremental journal

Write small batches of sequenced changes to a durable journal more frequently than full checkpoints.

Recovery becomes:

1. Load the latest checkpoint.
2. Read journal entries with higher sequence numbers.
3. Replay them in order.
4. Resume from the reconstructed state.

Evidence: F12.

### 09:45–10:45 — Zoom out and rebuild

End immediately after the journal with one continuous notebook zoom-out. Keep the original problem in the center and rebuild three responsibilities using miniature frames the viewer already saw:

1. **Real-time order:** small changes, authority, property conflicts.
2. **Responsive clients:** visible lag, pending over confirmed, offline replay.
3. **Durability:** complete checkpoints, checkpoint gap, journal recovery.

Highlight each responsibility while it is narrated. Finish with all three visible and ask which part the viewer would design differently.

## Material to keep out of the main episode

- Detailed Rust performance numbers; save them for a short or appendix.
- A taxonomy of alternative replicated-data architectures.
- Operational details not present in the public sources.
- Claims about Figma's current 2026 deployment architecture.

## Short-form extraction points

1. **Why WebSockets do not solve collaboration** — 45–60 seconds.
2. **Two users edit the same rectangle: who wins?** — 45 seconds.
3. **How Figma could lose 60 seconds of edits** — 60–75 seconds.
4. **Checkpoint versus journal** — 60 seconds.
