# Evidence map: Figma multiplayer

## Labels

- **Documented:** directly stated by Figma.
- **Inferred:** our interpretation of documented facts.
- **Proposed:** an educational design or simplification created for the episode.

## Documented claims

| ID | Claim | Source snapshot | Planned use |
| --- | --- | --- | --- |
| F01 | Figma's original model downloaded the document, edited locally, and periodically uploaded the whole document. | Figma, 2016 | Establish the naive design. |
| F02 | Whole-document saves caused collaborators to overwrite one another or see an old version. | Figma, 2016 | First failure demonstration. |
| F03 | Clients communicated with a cluster of servers over WebSockets, and Figma described a separate process for each multiplayer document. | Figma, 2019 | Introduce real-time transport and per-document coordination. |
| F04 | On reconnection, a client downloaded a fresh document and replayed offline edits before resuming synchronization. | Figma, 2019 | Offline scenario. |
| F05 | Figma's design was inspired by CRDTs but simplified around a central authoritative server. | Figma, 2019 | Research background for the authoritative-server choice; omitted from the main narration to preserve the build → break → fix flow. |
| F06 | Changes conflicted at the same-property, same-object boundary; the last value accepted by the server won. | Figma, 2019 | Animate simultaneous independent and conflicting edits. |
| F07 | Clients applied local changes immediately and suppressed conflicting server updates while a newer local change remained unacknowledged. | Figma, 2019 | Demonstrate optimistic UI and flicker prevention. |
| F08 | Clients generated unique object IDs; parent links and fractional indexing represented document trees and ordering. | Figma, 2019 | Research background; omitted from this focused episode and reserved for a possible document-structure follow-up. |
| F09 | Figma rewrote the performance-sensitive multiplayer core from TypeScript to Rust and described a Node.js process launching a Rust child process per document. | Figma, 2018 | Optional performance sidebar, not the core conflict story. |
| F10 | Multiplayer kept the active document in memory and checkpointed the encoded, compressed file to S3 every 30–60 seconds. | Figma, 2022 | Introduce the durability gap. |
| F11 | A crash in the checkpoint-only design could lose up to roughly 60 seconds of server-side work. | Figma, 2022 | Break the checkpoint-only design. |
| F12 | Figma added a DynamoDB-backed journal of sequenced incremental changes and replayed entries newer than the latest checkpoint. | Figma, 2022 | Introduce write-ahead recovery. |
| F13 | Figma used file ownership locks and conditional writes to prevent multiple Multiplayer instances from creating conflicting journal histories. | Figma, 2022 | Research background; omitted from this focused episode. |
| F14 | In 2022, Figma reported more than 2.2 billion received changes per day and 95% persisted within about 600 ms. | Figma, 2022 | Research background; omitted from this focused episode. |
| F15 | Figma compared journal replay with later checkpoints and reported roughly 400,000 consecutive successful validations before gradual rollout. | Figma, 2022 | Research background; omitted from this focused episode. |

## Proposed teaching claims

| ID | Claim | Label | Planned use |
| --- | --- | --- | --- |
| P01 | Polling for complete documents is an intermediate alternative before WebSockets. | Proposed | Optional rejected design; do not attribute to Figma. |
| P02 | A traffic simulation can represent edits as packets traveling between two clients and one authoritative server. | Proposed | Visual model, not a literal protocol trace. |
| P03 | Each level adds the smallest mechanism required to address the preceding failure. | Proposed | Episode narrative structure. |

## Inferences requiring careful wording

| ID | Inference | Evidence | Safe wording |
| --- | --- | --- | --- |
| I01 | Per-document coordination limits the scope of conflict ordering. | F03, F06 | “This design lets the multiplayer instance establish an order for one document.” |
| I02 | Checkpoints optimize for simplicity while the journal optimizes recovery point and write size. | F10–F12 | Present as our comparison, then show the documented mechanics. |
| I03 | Central authority trades decentralized complexity for server availability and ownership responsibilities. | F05, F13 | Present explicitly as a design tradeoff. |

## Historical uncertainty

These sources describe snapshots from 2016, 2018, 2019, and 2022. Unless a current source confirms a detail, narration must use wording such as “Figma described,” “in its 2019 architecture,” or “as of the 2022 article.”
