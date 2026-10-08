# e07-09: E07 Machine lost, against stage 8

**Verdict:** FAIL: **redirect p99 100.2 ms** (limit 100) and counts (accepted). E07's own rules pass: back 367 s after the loss; 1 link lost (404), 0 to the wrong page.

**System:** stage 8 on `sfp-app` (CX33, nbg1), 10 M links reseeded; E02 traffic for 18 minutes; machine deleted 420 s in; recovery on Better Stack's alert; `RECOVER_TYPE=cx33`; `CHECK_COUNTS=1`.

**Where the slow redirects come from:** Before the loss on server B: TCP connect p99 53.6 ms; after recovery on the newly built server C (id 169290623): **0.7 ms**; server answer p99 about 3 ms. Plain connect test to idle server C: p99 0.84 ms, none over 20 ms (`connect-tests.txt`).

**Diagnosis across `e07-06` to `e07-09`:** the slow tail is in opening the TCP connection, before nginx or the app sees the request, and it follows the machine: servers A and B (built by `recover.sh` in `e07-07` and `e07-08`) had about 1.5% of connects taking an extra 50–60 ms even when idle and with no HTTP involved; servers built in `e07-06` and `e07-09` did not. Server answer time stayed about 3 ms on all of them. Stage 8's change (a column, a takedown endpoint, a `410` branch in redirects) cannot affect TCP connects. Most likely cause: network placement of some Hetzner hosts (not established further; the slow machines were deleted by the runs themselves).
