# Topic brief: Shopify inventory reservations

## Central question

Two buyers, one last pair: how do we avoid promising the same unit twice?

## Viewer promise

By the end, the viewer should be able to explain:

1. Why "read, check, write" oversells under concurrency.
2. Why checkout needs reservations, not just an atomic update.
3. How one hot row turns a lock into a line.
4. Why inventory updates split across two systems need a recovery protocol.
5. How separate unit rows reduce contention while inventory transactions keep related changes together.
6. Why load testing still found hidden locks, deadlocks, and connection waits.

## Cold open

Alice and Bob tap **Buy** on the last pair at the same instant. Both see "Order confirmed." One pair ships.

## Proposed evolution

The series message: we build from scratch, and every piece is added only because the previous design broke. Shopify's documented failures anchor the later levels.

1. Level 0 — one stock number → race condition sells the pair twice (proposed)
2. Level 1 — atomic check-and-subtract → payment takes seconds and can fail (proposed)
3. Level 2 — reservations → one hot row becomes a line under flash-sale load (documented)
4. Level 3 — Redis counter → separate Redis and MySQL writes can disagree after a crash (documented)
5. Level 4 — one row per unit with `SKIP LOCKED`, bounded pool, replenishment (documented)
6. Level 5 — shared-connection bottleneck; index, gap-lock and deadlock details are optional (documented checkpoints)
7. Level 6 — shadow mode and gradual rollout (documented)

## Gates

| Gate | Pass? | Evidence |
| --- | --- | --- |
| First-party evidence exists | Yes, narrowly | Detailed Shopify Engineering post (2026-05-12); MySQL documentation supports the mechanisms. Claims verified in the evidence map; no independent throughput comparison claimed. |
| Problem visible in ten seconds | Yes | Two people buying the last item is universally understood. |
| Simple design fails honestly | Yes | Race condition, payment timing, contention, split-system atomicity. |

## Score

| Criterion | Weight | Score (0–5) | Weighted | Rationale |
| --- | ---: | ---: | ---: | --- |
| Evolution depth | 30% | 4 | 24 | Six levels; four backed by documented failures |
| Transferable lesson | 20% | 5 | 20 | Race conditions, atomicity, locking, deadlocks, connection pools |
| Curiosity hook | 15% | 5 | 15 | Two buyers, one last pair |
| Visual explainability | 15% | 4 | 12 | Shoppers, rows, locks, crashes; isolation details are harder |
| Distinctness | 10% | 5 | 10 | Recent published case with a concrete failure chain |
| Relevance | 10% | 5 | 10 | Production experience described in a dated engineering post |
| **Total** | 100% | | **91/100** | |

## Key sources

| Source | Publisher | Date | What it supports |
| --- | --- | --- | --- |
| [Scaling inventory reservations](https://shopify.engineering/scaling-inventory-reservations) | Shopify Engineering | 2026-05-12 | Redis design and failures, row-per-unit design, `SKIP LOCKED`, pool cap, load-test fixes, shadow rollout |
| [MySQL locking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html) | Oracle | — | `FOR UPDATE`, `SKIP LOCKED` |
| [InnoDB locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html) | Oracle | — | Gap locks, secondary and clustered index locks |

## Scope

- **In:** overselling, atomic updates, reservations, lock contention, split-system atomicity, `SKIP LOCKED`, bounded pools, load-test findings, shadow rollout.
- **Out:** payment processing internals, checkout admission queues, multi-location allocation, pricing.

## Risks

- Mostly one first-party source.
- Isolation levels and index locking can get too database-specific; keep them brief.
- Our level order differs from Shopify's chronology and must be worded as a teaching order.

## Decision

- Decision: Proceed
- Approved by: Hussain Abuwala
- Date: 2026-09-14

## Revised production route

The [episode README](../README.md) and [recording script](../scripts/recording-script.md) supersede the original level outline for presentation order. The main route uses 15 frames, with 3 optional database-detail frames. All worked examples are ours; company claims are scoped in the [evidence notes](evidence-map.md).
