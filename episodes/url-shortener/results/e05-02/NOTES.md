# e05-02: E05 Click counts, against stage 4 (attempt 2)

**Verdict: INVALID** (test-procedure error). The judge reported FAIL on counts; the cause was the test, not the system. Not counted towards the verdict; superseded by later runs.

**What the system did** (`url-shortener/stage-04`, CX33 nbg1, 10 M links, E04 traffic with counting on):

| Measure | Result | Rule |
| --- | ---: | ---: |
| Redirect p50 / p99 | 5.5 / 15.6 ms | p99 < 100 ms |
| Viral link p99 / other links p99 | 15.6 / 16.2 ms | < 100 ms |
| Create p99 | 28.0 ms | < 300 ms |
| Errors / wrong redirects / checker problems | 0 / 0 / 0 | 0 |
| Redirects letting browsers reuse them | 0 of 2,561 (`no-store`) | 0 |
| During the hold: average CPU / Node / nginx | 73% / 39% / 240% | — |
| During the hold: CPU waiting for disk / disk writes | 0.27% / about 0.9 MB/s | — |
| Connections turned away | 0 | — |

**Why the count check is invalid:** the link checker ran before the count check, and it opens 1,000 seeded links (plus every link created during the run) once each to verify their destinations. Each open is a real redirect the server counts, but the load generator's tally does not include it. Links with fewer than 100 clicks must be exact, so that single extra click failed them: the judge saw 84 of 1,101 links outside 1% (server 1,356,193 against 1,356,045 in total).

**Check of that explanation:** re-reading the server's counts for all 1,101 links and adding one click for each time the link checker opened that link: **0 of 1,101 outside 1%.**

**Fix:** `load/run-event.sh` now runs the count check before the link checker.
