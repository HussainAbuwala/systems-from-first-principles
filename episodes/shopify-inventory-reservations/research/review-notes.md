# Episode 2 review

## Narrative changes

The original draft had the right progression but combined each build, failure, terminology and next solution into dense panels. The revised route separates decisions into 15 widescreen frames. Questions reveal before advancing in the optional browser presenter. Shopify attribution lives in compact checkpoints with a linked evidence map.

Payment failure now earns durable state through the natural intermediate idea “just add it back,” followed by a server crash. Separate rows appear before the name `SKIP LOCKED`. The stock count explicitly increases before the parallelism example. Index, isolation and deadlock detail move to three optional frames; the shared-connection finding stays in the main story.

## Content corrections

| Draft issue | Revision |
| --- | --- |
| A correct counter seemed to mean a correct checkout | Separate stock allocation from payment and completed orders. |
| Lock duration and hold duration could be confused | Two short inventory transactions, with external payment between them. |
| Bare Redis decrement presented as sufficient | Explain atomic check-and-take, durable ownership and retry handling. |
| Redis described as having no line | Serialization still exists; speed must be measured for the workload. |
| Two-system atomicity described as impossible | Explain the commit gap and acknowledge recovery protocols as an alternative. |
| Crash examples omitted a concrete accounting model | Show explicit, labeled illustrative arithmetic. |
| One last unit used to motivate parallel winners | Switch to 100 pairs before the contention example. |
| `SKIP LOCKED` seemed to mean no waits or automatic correctness | It skips busy row candidates; empty results are not proof of stock exhaustion. |
| Unit row diagram blurred reserve and claim | Draw their transaction boundaries separately; payment remains external. |
| Pool exhaustion listed as undocumented | Correct against the source’s inline-refill explanation. |
| Pool might be confused with additional stock | Treat permits as a backed subset; refill must account for outstanding promises. |
| “No gap locks” stated absolutely | Note the constraint-check exceptions in `READ COMMITTED`. |
| Generic deadlock assigned to Shopify reserve/claim | Use T1/T2 and row A/B; distinguish it from the documented fix. |
| Queue alternative dismissed as unable to allocate | Acknowledge correctness and workload-dependent latency/throughput tradeoffs. |
| Platform sales metric used as reservation throughput evidence | Remove it from the main story; it is not a reservation benchmark. |

## Validation scope

Company claims checked against the May 2026 post; mechanisms checked against the MySQL reference manual. The scenario and pseudocode remain educational, with no claim of production completeness. The presentation is visually checked in a browser, including question reveal, frame navigation and recording view. No live inventory or payment system is implemented or load-tested here.
