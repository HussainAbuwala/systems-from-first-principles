# e04-01: E04 Viral spike, against stage 2

**Verdict: FAIL.** One run, per the repeat policy: redirect p99 9,356 ms is more than 1.5 times the 100 ms limit (about 94 times).

**System:** `url-shortener/stage-02` on `sfp-stage0` (CX23, 2 shared vCPU), 10,000,000 links. Load from `sfp-load` (CPX42). E02 traffic throughout; after a 60 s warm-up one link (`rv3z`) ramped from 0 to 2,000 clicks/s over 60 s, held 600 s, and fell back over 60 s. Every click a new TLS connection.

| Measure (720 s after warm-up) | Result | Rule |
| --- | ---: | ---: |
| Redirects measured | 1,386,880 (1,314,979 to the viral link) | — |
| Redirect p50 / p99 | 626 / 9,356 ms | p99 < 100 ms |
| Viral link p99 / every other link p99 | 9,440 / 9,012 ms | < 100 ms |
| Create p99 | 9,121 ms | < 300 ms |
| Errors (timeouts) | 18.4% | < 0.1% |
| Wrong redirects / checker problems | 0 / 0 | 0 |

**Where it broke** (10-second windows during the ramp, `windows.csv`)

| Time after start | Requests/s handled | Redirect p99 | Both vCPUs | nginx CPU | Node CPU |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 70 s | 359 | 16 ms | 65% busiest | 86% | 21% |
| 90 s | 1,027 | 27 ms | 93% | 150% | 27% |
| 100 s | 1,359 | 131 ms | 99% | 163% | 29% |
| 110 s | 1,671 | 240 ms | 100% | 169% | 30% |
| 120 s onward | about 2,100 offered | 2.7 s, then about 9.4 s | 100% | about 170% | about 30% |

- **Measured ceiling of stage 2 on a CX23:** it kept p99 under 100 ms up to roughly 1,000–1,350 new connections per second and fell off the cliff beyond that. The estimate before the run was about 1,000.
- **Both vCPUs were saturated** (100%), mostly by nginx (about 170% of a vCPU, i.e. both workers nearly flat out on TLS handshakes) with Node at about 30%. Steal stayed at 0%, waiting for disk under 1%, and the load machine peaked around 52% CPU, so the bottleneck was the system's CPU, not noise or the tool.
- **Everyone suffered, not only the viral link:** every other link's p99 was 9.0 s too. A hot link that is cheap to look up still costs a full TLS handshake per new visitor.
- nginx logged no errors; the 18% errors are client timeouts (10 s) while requests queued.
