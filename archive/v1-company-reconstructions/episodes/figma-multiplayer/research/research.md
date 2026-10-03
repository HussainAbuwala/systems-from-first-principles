# Research: Figma multiplayer

## User problem

Two or more people should be able to edit one design concurrently, see each other's changes quickly, continue working through temporary disconnections, and avoid permanently diverging copies of the document.

The technical design must preserve a user experience that feels local even though the authoritative state is coordinated over a network.

## Requirements derived from the problem

### Functional

- Open the latest shared document.
- Broadcast edits to other connected collaborators.
- Resolve simultaneous changes deterministically.
- Support object creation, deletion, reparenting, and reordering.
- Allow temporary offline editing and reconnection.
- Recover document state after a multiplayer server failure.

### Quality attributes

- **Responsiveness:** local interaction should not wait for a server round trip.
- **Convergence:** connected clients should eventually agree on document state.
- **Durability:** accepted edits should survive process failure.
- **Correctness:** the document must remain structurally valid.
- **Scalability:** document coordination must not depend on one global process.
- **Simplicity:** use only the conflict machinery required by a design editor.

## Evolution from the simplest solution

### Level 0: Periodically replace the whole document

The client downloads a document, edits locally, and periodically uploads the complete document.

- **Why it works:** one editor has a straightforward save model.
- **Why it fails:** two editors can upload different snapshots and overwrite each other. A collaborator can also open a stale version while another save is still pending.
- **Production evidence:** Figma describes this as its original saving model in its 2016 multiplayer launch article.

### Level 1: Send incremental updates in real time

Maintain a WebSocket connection and transmit changes as they happen.

- **Benefit:** collaborators see smaller updates without repeatedly replacing the complete file.
- **New problem:** network delay means clients can observe or create concurrent changes in different orders.

### Level 2: Make the server authoritative

Route editors of a document through an authoritative multiplayer instance that validates and orders updates.

- **Benefit:** the server supplies one accepted order instead of requiring every peer to coordinate independently.
- **New problem:** edits must still feel instantaneous to the person making them.
- **Production evidence:** Figma described a client/server model over WebSockets and a separate process per multiplayer document in 2019. In 2022 it described Multiplayer as authoritative for validation, ordering, and conflict resolution.

### Level 3: Resolve conflicts at the property boundary

Treat properties on objects as independent conflict domains. Two edits conflict only when they update the same property of the same object; the server's latest accepted value wins.

- **Benefit:** changing a rectangle's color does not conflict with moving it.
- **Constraint:** simultaneous editing of one text value is not merged character by character under this model.
- **Production evidence:** Figma calls its design CRDT-inspired rather than a true decentralized CRDT. Central authority lets the server order events without timestamps.

### Level 4: Apply local edits optimistically

Render the user's change locally before receiving server acknowledgement.

- **Benefit:** interaction is not delayed by network round-trip time.
- **New problem:** an older acknowledged value arriving from the server can temporarily overwrite a newer unacknowledged local value and cause flicker.
- **Documented approach:** Figma described ignoring incoming changes that conflict with still-unacknowledged local property changes.

### Level 5: Preserve identity and document structure

Clients create globally unique object IDs using a unique client identifier. Parent-child relationships are stored as a parent property on the child. The server rejects parent changes that would create a cycle. Ordered children use fractional positions.

- **Benefit:** offline object creation does not require a synchronous server-assigned ID.
- **Tradeoff:** rare temporary cycles may exist in a client's optimistic prediction until the server rejects an update.

### Level 6: Reconcile after working offline

On reconnection, download a fresh document, replay offline changes on top of it, and resume update synchronization.

- **Benefit:** reconnecting is conceptually simpler than coordinating two long-lived peer histories.
- **Production evidence:** Figma documented this model in 2019.

### Level 7: Checkpoint in-memory state

Keep active document state in memory for low latency and periodically encode, compress, and upload the complete file to durable object storage.

- **Benefit:** simple persistence and recovery point.
- **Failure:** a process crash can lose edits accepted after the most recent checkpoint. Closing many files during deployment can also create a checkpoint write spike.
- **Production evidence:** Figma documented 30–60 second checkpoints to S3 in 2022.

### Level 8: Journal incremental changes

Assign edits increasing sequence numbers and asynchronously persist batches of changes to a durable journal. Restore the latest checkpoint and then replay newer journal entries.

- **Benefit:** recovery approaches the latest accepted state without writing the whole file for every edit.
- **Documented implementation:** Figma described DynamoDB as the journal datastore, file ownership locks to prevent split brain, strongly consistent reads after ownership acquisition, and continued S3 checkpoints for cross-region recovery.
- **Reported 2022 result:** the journal handled more than 2.2 billion received changes per day and persisted 95% within about 600 ms.

## Important tradeoffs

### Central authority versus a decentralized CRDT

Figma did not need independent peers to converge without a server. Central authority reduced metadata and algorithmic complexity, but the server became responsible for ordering, validation, availability, and document ownership.

### Last writer wins versus semantic merging

Property-level last-writer-wins is simple and fits many graphical edits. It intentionally does not solve every collaboration problem, such as character-level simultaneous text merging.

### In-memory speed versus durability

Keeping an active file in memory makes updates fast. Checkpoints and the later journal compensate for volatility at different write frequencies and payload sizes.

### Full checkpoints versus incremental journal entries

Checkpoints are self-contained but their cost grows with file size. Journal entries are smaller but recovery and correctness depend on ordering, complete capture of mutations, and ownership control.

## Open questions

- What parts of the 2016–2022 architecture remain unchanged today?
- What are the current limits for collaborators, file size, and per-document throughput?
- How are WebSocket routing and regional placement implemented today?
- What are the precise acknowledgement and retry semantics between clients and Multiplayer?
- Which database or service stores current checkpoints and their metadata beyond the documented use of S3 for file blobs?

## Claims we will not make

- That this is Figma's complete current architecture.
- That Figma uses a textbook CRDT implementation.
- That last-writer-wins guarantees preservation of every user's intent.
- That the journal makes accepted edits impossible to lose under every failure scenario.
- That a separate process per document remains the current deployment model unless a newer source confirms it.
