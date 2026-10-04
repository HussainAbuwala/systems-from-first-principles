# e03-08, e03-09, e03-10: E03 against stage 2 (attempt 2)

**Combined verdict: PASS** in 3 of 3 runs (`results/verdicts/E03-stage-02.json`). Deployed: `url-shortener/stage-02` (nginx with `keepalive_timeout 4s` to the upstream).

| Measure | e03-08 | e03-09 | e03-10 | Rule |
| --- | ---: | ---: | ---: | ---: |
| Redirect p50 / p99 (ms) | 6.4 / 71.0 | 6.3 / 68.5 | 6.4 / 69.2 | p99 < 100 |
| Name-request p99 (ms) | 100.1 | 93.0 | 94.4 | < 300 |
| Create p99 (ms) | 38.5 | 37.1 | 38.0 | < 300 |
| Errors | 0% | 0% | 0% | < 0.1% |
| Rounds with exactly one winner and 49 "taken" | 1,000 / 1,000 | 1,001 / 1,001 | 1,000 / 1,000 | all |
| nginx error-log lines during the run | 0 | 0 | 0 | — |
| Link checker problems | 0 | 0 | 0 | 0 |

**Where the CPU went** (sfp-stage0, per-second average / peak over the measured 5 minutes)

| | Stage 1 (e03-03, e03-04) | Stage 2 (e03-08 to e03-10) |
| --- | ---: | ---: |
| Node process | 52% / 77% | 10% / 22% |
| nginx (both workers together) | — | 42% / 51% |
| vCPU 0 / vCPU 1 busy | busiest core 53% / 61% | 30% / 29% (peaks about 40%) |
| Steal | 0% | 0% |
| Waiting for disk | under 1% | under 1% |

Node's CPU fell from about half a vCPU to a tenth: the TLS handshakes moved to nginx. nginx plus Node together use about as much CPU as Node alone did, so nginx is not doing the work more cheaply; it is doing it **on both vCPUs at once**, which halves the queue behind each burst of 50 handshakes. The two vCPUs are now evenly loaded.

**Regression checks on stage 2:** E01 (`e01-03`, `e01-04`) redirect p99 15.4 and 15.0 ms; E02 (`e02-04`) redirect p99 11.2 ms, create p99 20.5 ms, no errors. All PASS.
