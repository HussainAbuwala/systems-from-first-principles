# Episode selection

Use this before starting a new **Systems from First Principles** problem. A problem must pass every gate, then earn its place on the score.

## Gates

A problem that fails any gate is rejected, regardless of score.

1. **It comes up in interviews,** or it teaches a pattern that common interview problems rely on.
2. **It can be load tested with scripts.** Every event on the script can be generated and checked by code. If a real third party is involved (payments, maps, email), it can be replaced by a fake whose behaviour is stated in the episode.
3. **A believable stage 0 exists:** simple, free or nearly free, and good enough for real users at small scale.
4. **The top of the ladder is affordable to measure.** Problems dominated by egress or storage cost (video streaming, large file hosting) usually fail this gate.

## Score

Score each criterion from 0 to 5, then compute `weight × score ÷ 5`. The maximum total is 100.

| Criterion | Weight | 1 — weak | 3 — solid | 5 — excellent |
| --- | ---: | --- | --- | --- |
| **Convention gap** | 25% | The usual answer is already simple | The usual answer adds a few boxes early | The usual answer is heavily over-built, so stage 0 going far is a real surprise |
| **Interview frequency** | 25% | Rarely asked | Asked at some companies | One of the standard problems |
| **Arc depth** | 20% | One or two breaks | Four or more events that genuinely break something | Six to eight events, mixing load, requirements and failures |
| **Visible break** | 15% | The break only shows in a log | The break shows on a latency or error graph | The break is something a user would notice, and it shows on a graph |
| **Distinctness** | 15% | Reteaches a previous episode | New problem, mostly familiar patterns | Introduces patterns the series has not covered |

### Decision rule

- **Proceed:** passes all gates, scores **70 or higher**, and no criterion scores below 2.
- **Park:** passes all gates but misses the threshold. Record why.
- **Reject:** fails a gate.

## Candidates

Not yet scored, except where noted.

| Problem | Notes |
| --- | --- |
| **URL shortener** | **Chosen first** (2026-10-01). Most-covered problem, so the contrast is strongest; read-heavy, hot links, analytics, takedown, multi-region. |
| Rate limiter | Small and sharp; distributed counting and clock problems appear quickly. |
| Chat / messaging | Long-lived connections, fan-out, ordering, offline delivery. Load testing many open connections is its own challenge. |
| News feed | Fan-out on write vs read; celebrity accounts as hot keys. |
| Leaderboard / top-K | Counting at speed; exact vs approximate. |
| Ticket booking / flash sale | Contention on the last item. Overlaps the archived Shopify inventory work, which can be reused. |
| Notification system | Queues, retries, deduplication, provider fakes (gate 2). |
| Typeahead / autocomplete | Read-heavy, latency-critical, index rebuilds. |
| Job scheduler | Exactly-once execution, leases, crashes mid-job. |

Likely to fail a gate: video streaming (gate 4, egress cost), web crawler (gate 2 unless crawling a synthetic web we host), ride matching (gate 2 needs a convincing fake of moving drivers; possible but heavy).
