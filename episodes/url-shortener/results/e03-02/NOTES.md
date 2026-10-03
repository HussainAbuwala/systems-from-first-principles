# e03-02: E03 Custom names, against stage 1

**Verdict: FAIL** on one rule: redirect p99 179.5 ms (rule: under 100 ms). Every correctness rule passed.

**System:** `url-shortener/stage-01` on `sfp-stage0` (CX23), 10,000,000 links seeded. Load from `sfp-load` (CPX42).

| Measure | Result | Rule |
| --- | ---: | ---: |
| Contention rounds | 1,000 of 1,000 | 1,000 |
| Rounds with exactly one winner and 49 "taken" | **1,000** | all |
| Name requests (50 per round) p99 | 207.5 ms | < 300 ms |
| Redirect p50 / p99 | 8.8 / **179.5 ms** | p99 < 100 ms |
| Create p99 | 66.1 ms | < 300 ms |
| Errors | 0% | < 0.1% |
| Wrong redirects | 0 | 0 |
| Link checker | 2,721 links (1,000 winning names), 0 problems | 0 |
| Unloaded lookup, median: counter codes / names | 3.79 / 3.75 ms | — |

**Why the redirects slowed down: bursts, not averages**

| | E02 rerun (e02-02) | E03 (e03-02) |
| --- | ---: | ---: |
| Redirect p50 | 6.4 ms | 8.8 ms |
| Redirect p90 | 7.9 ms | 116.5 ms |
| Redirect p99 | 12.9 ms | 179.5 ms |
| Redirects over 100 ms | 0.02% | 13.15% |
| Node CPU, per-second average / peak | 27% / 40% | 54% / 74% |
| CPU waiting for disk | 0.3% | 0.8% |

- The disk wall from e03-01 is gone: only the winner saves, so iowait stayed under 1%.
- Node never used a whole core in any one second (peak 74%), yet one redirect in eight took over 100 ms. Each round delivers 50 new TLS connections at the same instant; Node handshakes them one after another on its single thread (about 1.8 ms each per calib-01, so roughly 90 ms of work), and any redirect that arrives during a burst waits behind it. With about 3.3 rounds a second, the thread spends a large share of each second inside a burst. One-second averages hide this; the latency distribution shows it (median almost unchanged, p90 up fifteen-fold).
- **The single thread cuts both ways:** it is why check-then-save never raced (1,000 of 1,000 rounds had exactly one winner), and it is why a burst of handshakes makes everyone else wait.
