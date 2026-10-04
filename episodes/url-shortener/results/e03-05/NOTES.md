# e03-05, e03-06, e03-07: E03 against stage 2 (first attempt)

**Combined verdict: FAIL** in 3 of 3 runs, on one rule: a few contention rounds had a 502 error instead of "taken" for some losers. Latency now passes.

| Measure | e03-05 | e03-06 | e03-07 | Rule |
| --- | ---: | ---: | ---: | ---: |
| Redirect p50 / p99 (ms) | 6.6 / 71.2 | 6.4 / 71.1 | 6.5 / 68.5 | p99 < 100 |
| Name-request p99 (ms) | 99.3 | 103.1 | 91.2 | < 300 |
| Create p99 (ms) | 35.8 | 37.9 | 38.3 | < 300 |
| Errors | 0.036% | 0.015% | 0.030% | < 0.1% |
| Rounds with exactly one winner and 49 "taken" | 993 / 1,001 | 996 / 1,001 | 990 / 1,001 | all |
| Rounds with two or more winners | 0 | 0 | 0 | 0 |
| Failed requests | 29 × 502 (name requests) | 12 × 502 (name) + 1 × 502 (create) | 24 × 502 (name requests) | — |
| Link checker problems | 0 | 0 | 0 | 0 |

**What improved:** redirect p99 fell from 170–180 ms on stage 1 to 68–71 ms. Moving TLS handshakes to two nginx workers removed the queue behind each burst on Node's thread.

**What broke:** every failed request was a `POST /links` answered with **502 Bad Gateway** by nginx; no redirect failed. nginx's error log (71 lines) shows `recv() failed (104: Connection reset by peer) while reading response header from upstream`: nginx sent a request to Node on a kept-open local connection that Node had just closed.

**Likely cause:** mismatched idle timeouts. Node's HTTP server closes a kept-open connection after 5 seconds idle (its default `keepAliveTimeout`); nginx keeps idle upstream connections for 60 seconds (its default `keepalive_timeout`). When nginx reuses a connection at the moment Node closes it, the request is lost. nginx retries such failures for idempotent requests like GET on a fresh connection, but not for POST, which may have side effects; that is why only creates failed. Bursts of 50 name requests open more local connections than the 32 nginx keeps, so idle connections near Node's 5-second limit are common.

**Correctness held:** no round ever had two winners, and every link checked afterwards was correct. The rule failed because some losers got an error instead of "taken".

The E01 regression check (e01-03) passed: redirect p99 15.4 ms. The E02 regression check did not start: the batch was stopped by the session's background time limit after e01-03.
