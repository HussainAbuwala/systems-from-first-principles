# Episode candidates

Scored against the [episode selection criteria](episode-selection.md) on 2026-09-14. Scores are pre-research estimates from first-party sources; confirm them in the topic brief before approval.

## Ranking

| Rank | Candidate | Central question | Evolution (30) | Transfer (20) | Hook (15) | Visual (15) | Distinct (10) | Relevance (10) | Total | Decision |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Shopify inventory reservations | Two buyers, one last item: how does a flash sale never sell it twice? | 4 → 24 | 5 → 20 | 5 → 15 | 4 → 12 | 5 → 10 | 5 → 10 | **91** | Approved 2026-09-14 |
| 2 | Discord message storage | How does Discord open any channel instantly when it stores trillions of messages? | 5 → 30 | 4 → 16 | 4 → 12 | 4 → 12 | 2 → 4 | 4 → 8 | **82** | Proceed to brief |
| 3 | Find My offline finding | How can a tracker with no GPS or internet find your suitcase without letting anyone track you? | 3 → 18 | 4 → 16 | 5 → 15 | 5 → 15 | 3 → 6 | 5 → 10 | **80** | Proceed to brief |
| 4 | Dropbox sync engine | Two offline laptops move the same folder. What should the Dropbox folder look like afterward? | 4 → 24 | 4 → 16 | 4 → 12 | 5 → 15 | 2 → 4 | 3 → 6 | **77** | Proceed to brief |
| 5 | Stripe payments API | Why did Stripe redesign how online payments work twice in ten years? | 4 → 24 | 4 → 16 | 3 → 9 | 3 → 9 | 4 → 8 | 3 → 6 | **72** | Proceed, low priority |
| 6 | Slack Flannel edge cache | Why did opening Slack get slower as companies grew? | 2 → 12 | 4 → 16 | 3 → 9 | 3 → 9 | 3 → 6 | 2 → 4 | **56** | Park |

## Notes

### Shopify inventory reservations

- **Evolution:** a single quantity row cannot handle contention → Redis reservations separate from the inventory ledger cannot commit atomically, so payment and deduction can disagree → one MySQL row per sellable unit with `SKIP LOCKED` → documented follow-up failures: double row locks from an auto-increment key, gap locks under `REPEATABLE READ`, deadlocks from inconsistent lock order, and connection-pool exhaustion.
- **Why it ranks first:** documented failures, interview-grade concepts (race conditions, atomicity, row locking, deadlocks), a universally understood cold open, and a May 2026 source that few have explained.
- **Risks:** gate 1 rests mainly on one post; supporting Shopify flash-sale posts cover checkout throttling rather than reservations. Lock and isolation details can become too database-specific, so keep the story on "never sell the last unit twice."
- **Sources:** [Scaling inventory reservations](https://shopify.engineering/scaling-inventory-reservations) (2026-05-12); [Surviving flashes of high-write traffic, part I](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i) and [part II](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-ii).

### Discord message storage

- **Evolution:** one MongoDB replica set runs out of RAM at 100 million messages → Cassandra partitioned by channel → partitions exceed 100 MB, so messages are bucketed by time → deleted-message tombstones cause 10-second GC pauses → at 177 nodes, hot partitions and GC pauses cause cascading latency → Rust data services with request coalescing and consistent-hash routing → ScyllaDB migration in about nine days (72 nodes, 15 ms p99 reads).
- **Why it ranks high:** the deepest chain of documented production failures of any candidate.
- **Risks:** widely covered by other system-design channels; needs a sharper angle than "Discord switched databases."
- **Sources:** [How Discord stores billions of messages](https://discord.com/blog/how-discord-stores-billions-of-messages) (2017-01-13); [How Discord stores trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) (2023-03-06).

### Find My offline finding

- **Evolution:** GPS trackers need power and connectivity → Bluetooth only works near the owner → nearby strangers' devices report locations → a fixed identifier lets anyone follow the tracker, so keys rotate about every 15 minutes and locations are end-to-end encrypted so Apple cannot read them → bad actors use AirTags to track people → unwanted-tracking alerts, louder sounds, Precision Finding, and the cross-platform Apple–Google specification.
- **Why it ranks high:** the strongest hook and visuals, plus privacy engineering that rarely appears in system-design content.
- **Risks:** Apple documents the design, not its early failures, so the first levels are **proposed** teaching steps; only the stalking misuse is documented. An earlier Short covered this topic, so the long form must go beyond it.
- **Sources:** [Find My security](https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web); [An update on AirTag and unwanted tracking](https://www.apple.com/newsroom/2022/02/an-update-on-airtag-and-unwanted-tracking/) (2022-02-10); [Apple and Google unwanted tracking alerts](https://www.apple.com/newsroom/2024/05/apple-and-google-deliver-support-for-unwanted-tracking-alerts-in-ios-and-android/) (2024-05).

### Dropbox sync engine

- **Evolution:** files keyed by path make a folder rename thousands of deletes and adds, briefly showing inconsistent subtrees → a permissive protocol allows orphaned files → concurrent local and remote moves create a directory cycle → Nucleus keys files by ID, keeps remote, local, and synced trees as a merge base, and runs on one deterministic control thread.
- **Risks:** concepts overlap heavily with Figma multiplayer (concurrent edits, offline work, conflicts); sources are from 2020.
- **Sources:** [Rewriting the heart of our sync engine](https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine) (2020-03-09); [Testing sync at Dropbox](https://dropbox.tech/infrastructure/-testing-our-new-sync-engine) (2020-04-20).

### Stripe payments API

- **Evolution:** synchronous card Charges → ACH and Bitcoin do not finalize immediately, adding pending states → Sources create two intertwined state machines, and a lost browser connection can refund funds without creating a charge → PaymentIntents unify the state machine and remove webhooks from the critical path → Stripe admits card-only integrations became harder. Idempotency keys fit as a retry-safety level.
- **Risks:** a story about API design more than infrastructure; state machines are hard to make visual.
- **Sources:** [Stripe's payments APIs: the first 10 years](https://stripe.dev/blog/payment-api-design) (2020-12-15); [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency).

### Slack Flannel edge cache

- **Evolution:** `rtm.start` sends a full team snapshot on connect → large teams wait on loading screens, and reconnect storms follow outages → Flannel edge cache lazily loads users and channels (44× smaller payloads for 32,000-user teams).
- **Why parked:** only two or three levels, a 2017 source, and Slack has since re-architected parts of its client.
- **Sources:** [Flannel: an application-level edge cache](https://slack.engineering/flannel-an-application-level-edge-cache-to-make-slack-scale/) (2017-05-31, updated 2020).
