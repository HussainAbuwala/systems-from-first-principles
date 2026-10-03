# e03-01: E03 Custom names, against stage 0

**Verdict: FAIL** (expected). This run is the measured trigger for stage 1.

**System:** stage 0 as tagged `url-shortener/stage-00`, deployed earlier on `sfp-stage0` (CX23). `run.json` records the laptop's commit at the time (`11337d5` with uncommitted stage 1 work), not the deployed code; deployments record their version on the server from stage 1 on.

| Measure | Result | Rule |
| --- | ---: | ---: |
| Contention rounds completed | 986 of 1,000 | 1,000 |
| Rounds with exactly one winner | **0** | all |
| Rounds where all 50 "won" | **986** | 0 |
| Redirect p50 / p99 | 4,646 / 12,453 ms | p99 < 100 ms |
| Create p99 | 11,078 ms | < 300 ms |
| Name-request p99 | 17,685 ms | < 300 ms |
| Errors | 18.4% | < 0.1% |
| Link checker | 1,703 links, 0 problems | 0 |

**Why it failed twice**

1. **No names:** stage 0 ignores the `name` field, so every contender received a new counter code and a 201. Nobody is told "taken".
2. **Disk waits:** because all 50 contenders "won", every round saved 50 links: about 165 saves/s instead of 2. SQLite's default settings wait for each save to reach the disk, and Node's single thread waits with them.

| Resource (sfp-stage0) | E02 (e02-01) | E03 on stage 0 |
| --- | ---: | ---: |
| Disk writes, average | 183 KB/s | 8,962 KB/s |
| CPU time waiting for disk (iowait), average | 0.4% | 14.8% |
| Node process CPU, average / peak | 34% / 52% | 58% / 79% |

Node never reached 100% of a core: the bottleneck was the thread blocked on synchronous disk writes, not computation. The load machine (CPX42) stayed at or below 11% CPU; windows marked SATURATED are the server falling behind.
