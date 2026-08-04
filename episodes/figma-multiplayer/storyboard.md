# Storyboard: Figma multiplayer

## Visual direction

Use an original design-canvas interface rather than reproducing Figma's product UI. The recurring object is a rounded rectangle with four editable properties: position, fill, label, and parent. Alice is represented by a solid cursor and Bob by an outlined cursor; names and shapes accompany color so identity never depends on color alone.

The architecture grows in place along a horizontal path:

```text
Alice client <-> network <-> document authority <-> durability
Bob client   <-> network <-> document authority <-> durability
```

## Visual grammar

| Concept | Treatment |
| --- | --- |
| Local unacknowledged edit | Small clock marker and dotted packet outline |
| Server-accepted edit | Check marker and solid packet outline |
| Different properties | Separate labeled chips such as `position` and `fill` |
| True conflict | Two packets with the same object ID and property name |
| Failure | Component desaturates; the failed edge breaks visibly |
| Recovery | State rebuilds from left to right using sequence numbers |
| Documented claim | Small source marker with publication year |
| Proposed teaching model | Small `MODEL` marker |

## Scene plan

| # | Time | Purpose | Screen action | Narration beat | Evidence |
| --- | --- | --- | --- | --- | --- |
| 01 | 00:00 | Hook | Split canvas: Alice and Bob edit the same rectangle. Their `fill` packets race toward the center. Freeze before either wins. | “Two people edit the same object at almost the same time. Who wins?” | F06 |
| 02 | 00:15 | Establish stakes | Pull the two canvases apart with a network path between them. Add latency and disconnect symbols. | The editor must converge without feeling remote. | Proposed framing |
| 03 | 00:30 | Evidence contract | Show three compact labels: Documented, Inferred, Proposed. Then collapse them into a small persistent source marker. | We are reconstructing dated public evidence, not claiming Figma's private current architecture. | Research policy |
| 04 | 01:05 | Naive single-user model | One client downloads `document v1`, edits it, and uploads `document v2`. | Whole-document saving is a reasonable first implementation. | F01 |
| 05 | 01:35 | Break whole-document saves | Alice and Bob both download v1. Alice uploads v2A. Bob uploads v2B from stale v1; Alice's change vanishes. | Last upload silently overwrites earlier work. | F02 |
| 06 | 02:15 | Introduce incremental updates | Replace full-file arrows with a persistent connection and small `position:x=420` packets. | Send changes while the file is open. | F03 |
| 07 | 02:45 | Show unresolved concurrency | Alice and Bob packets cross in the network and arrive in different orders at the opposite clients. Canvases diverge. | Faster transport does not define a single outcome. | Proposed model |
| 08 | 03:20 | Add authority | Insert one Multiplayer node. All packets route through it and receive sequence badges `41`, `42`. | One authority validates and orders changes for the document. | F03, F05 |
| 09 | 04:30 | Non-conflicting edits | Alice sends `shape-7.position`; Bob sends `shape-7.fill`. The authority accepts both and both canvases converge. | Same object does not necessarily mean conflict. | F06 |
| 10 | 05:05 | Conflicting edits | Both send `shape-7.fill`. Authority accepts one then the other; sequence 44 becomes final. | Same object plus same property is a conflict; latest accepted value wins. | F06 |
| 11 | 05:40 | Show round-trip lag | Alice drags the rectangle but a ghost remains under her cursor until the server response returns. A latency dial rises. | Waiting for acknowledgement makes direct manipulation feel broken. | Inferred motivation |
| 12 | 06:05 | Add optimistic updates | Rectangle follows Alice immediately. A pending chip becomes confirmed after acknowledgement. | Apply locally first, reconcile afterward. | F07 |
| 13 | 06:25 | Show the backward jump | A full-width naive client paints `100 → 200 → 130 → 200`; the rectangle visibly moves backward when the older server value arrives. | Painting every arrival allows older confirmed state to cover newer local intent. | F07 |
| 14 | 06:38 | Keep pending state on top | On a new frame, show confirmed `x=130` underneath pending `x=200`; the visible rectangle remains at 200 until acknowledgement clears the pending layer. | Confirmed state may update underneath without causing a visible backward jump. | F07 |
| 15 | 06:50 | Go offline | Break Bob's connection. Both users continue editing different properties. Bob's edits stack locally. | Offline work creates a second history that must be reconciled. | F04 |
| 16 | 07:15 | Reconnect | Bob downloads fresh state, then his queued operations replay. Both canvases converge. | Fresh state plus replay simplifies reconnection. | F04 |
| 17 | 07:50 | Reveal volatile state | Zoom from the canvas into the in-memory Multiplayer node. Every 30–60 seconds it emits a complete checkpoint to S3. | Fast active state is volatile. | F10 |
| 18 | 08:20 | Expose and close the checkpoint argument | Accept edits 101–105, crash, and recover only checkpoint 100. On the same frame, test checkpointing every edit, then batching; show complete-file write cost and the returning durability gap before revealing small durable deltas. | More frequent complete checkpoints trade the gap for repeated full-file work; batching recreates the gap, motivating a journal. | Proposed model; F11, F12 |
| 19 | 09:25 | Replay recovery | Load checkpoint 100, replay journal 101–105, and restore the exact visible arrangement. | Snapshot plus ordered changes reconstructs the latest persisted state. | F12 |
| 20 | 09:55 | Zoom out and rebuild | Pull away from the center problem. Actual miniatures of earlier scenes form three branches—order, responsive clients, and durability. Highlight each branch during its recap, then illuminate all three. | One problem created three responsibilities; every component was earned by a failure. | F03–F12 |

## Reusable animation components

Build these only after the narration timing is locked:

- `DesignCanvas` — displays the shared canvas and editable shapes.
- `CollaboratorCursor` — cursor, name, and identity shape.
- `EditPacket` — object ID, property, value, pending/accepted state, and sequence number.
- `NetworkPath` — connected, delayed, disconnected, and recovered states.
- `DocumentAuthority` — accepted state, ordering, and validation.
- `PropertyState` — current server value plus unacknowledged client value.
- `CheckpointStore` — complete snapshot and latest sequence number.
- `ChangeJournal` — ordered or batched sequence ranges.
- `SourceMarker` — evidence ID, publisher, and year.

## Framing for multiple formats

- Compose the 16:9 master around a central safe column that can survive a 9:16 crop.
- Keep clients vertically stackable instead of permanently placing them at extreme left and right.
- Avoid essential labels in the outermost 15% of the frame.
- Build short clips as their own compositions using the same components rather than blindly cropping the long-form timeline.

## Audio cues

- Soft send sound for an edit packet.
- Distinct confirmation sound for server acceptance.
- Brief muted click for a rejected conflicting edit.
- No continuous background interface sounds; reserve audio cues for state transitions.
