# e07-08: E07 Machine lost, against stage 8

**Verdict:** FAIL: **redirect p99 117.8 ms** (limit 100) and counts (accepted). E07's own rules pass: back 236 s after the loss; 3 links lost from the old server's last moment (404), 0 to the wrong page.

**System:** stage 8 on `sfp-app` (CX33, nbg1), 10 M links reseeded; E02 traffic for 18 minutes; machine deleted 420 s in; recovery on Better Stack's alert; `RECOVER_TYPE=cx33`; `CHECK_COUNTS=1`.

**Where the slow redirects come from:** Before the loss on server A: TCP connect p99 53.4 ms; after recovery on the newly built server B (id 169288932): 53.6 ms; server answer p99 about 3.5 ms throughout. Plain connect test to idle server B: p99 61.0 ms, 17 of 1,151 over 20 ms.

**Diagnosis across `e07-06` to `e07-09`:** the slow tail is in opening the TCP connection, before nginx or the app sees the request, and it follows the machine: servers A and B (built by `recover.sh` in `e07-07` and `e07-08`) had about 1.5% of connects taking an extra 50–60 ms even when idle and with no HTTP involved; servers built in `e07-06` and `e07-09` did not. Server answer time stayed about 3 ms on all of them. Stage 8's change (a column, a takedown endpoint, a `410` branch in redirects) cannot affect TCP connects. Most likely cause: network placement of some Hetzner hosts (not established further; the slow machines were deleted by the runs themselves).
