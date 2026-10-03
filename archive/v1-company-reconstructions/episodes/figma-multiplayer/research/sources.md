# Primary sources: Figma multiplayer

All sources were accessed on 2026-08-02. They are ordered by the architecture story rather than publication date.

## Core sources

### 1. Multiplayer Editing in Figma

- **Publisher:** Figma
- **Published:** 2016-09-28
- **URL:** https://www.figma.com/blog/multiplayer-editing-in-figma/
- **Supports:** the original whole-document saving model, overwrites and stale versions, early multiplayer motivation, conflict and undo challenges.

### 2. How Figma's multiplayer technology works

- **Publisher:** Figma
- **Published:** 2019
- **URL:** https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
- **Supports:** WebSockets, per-document processes, reconnect behavior, CRDT inspiration, central authority, property-level last-writer-wins, optimistic client updates, object identifiers, tree constraints, and fractional indexing.

### 3. Making multiplayer more reliable

- **Publisher:** Figma
- **Published:** 2022-10-20
- **URL:** https://www.figma.com/blog/making-multiplayer-more-reliable/
- **Supports:** authoritative in-memory Multiplayer state, checkpoints, the durability gap, DynamoDB journal, sequence numbers, batching, ownership locks, recovery, cross-region considerations, validation, and reported scale.

## Supporting sources

### 4. Rust in production at Figma

- **Publisher:** Figma
- **Published:** 2018-05-02
- **URL:** https://www.figma.com/blog/rust-in-production-at-figma/
- **Supports:** the TypeScript-to-Rust performance rewrite and the documented Node.js/Rust process arrangement at that time.

### 5. Realtime Editing of Ordered Sequences

- **Publisher:** Figma
- **Published:** 2017
- **URL:** https://www.figma.com/blog/realtime-editing-of-ordered-sequences/
- **Supports:** Figma's use of fractional indexing for ordering objects under concurrent editing.

### 6. Under the hood of Figma's infrastructure

- **Publisher:** Figma
- **Published:** 2019-11-21
- **URL:** https://www.figma.com/blog/under-the-hood-of-figmas-infrastructure/
- **Supports:** one Multiplayer instance per design file in the 2019 architecture and the infrastructure scaling context at that time.

## Research policy

- Prefer these first-party sources over third-party system-design summaries.
- Use third-party material only for independent background concepts, never as proof of Figma's implementation.
- Preserve publication dates in scripts and on-screen citations.
- Create original diagrams instead of copying Figma's diagrams or artwork.
