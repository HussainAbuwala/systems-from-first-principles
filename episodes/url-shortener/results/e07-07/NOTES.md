# e07-07: E07 Machine lost, against stage 8

**Verdict:** PASS on E07's own rules (back 298 s after the loss; 1 link lost from the old server's last moment, answering 404; 0 to the wrong page); FAIL on counts (accepted). Redirect p99 97.9 ms, within 25% of the 100 ms limit, so two more runs (`e07-08`, `e07-09`).

**System:** stage 8 on `sfp-app` (CX33, nbg1), 10 M links reseeded; E02 traffic for 18 minutes; machine deleted 420 s in; recovery on Better Stack's alert; `RECOVER_TYPE=cx33`; `CHECK_COUNTS=1`.

**Where the slow redirects come from:** Before the loss (server built in `e07-06`): TCP connect p99 0.7 ms. After recovery, on the newly built server ("server A", id 169287111): **TCP connect p99 53.3 ms**, server answer p99 3.6 ms, TLS p99 4.2 ms. A plain TCP connect test from a load machine to that idle server afterwards: p99 60.3 ms, 18 of 1,150 connects over 20 ms (max 66 ms).

**Diagnosis across `e07-06` to `e07-09`:** the slow tail is in opening the TCP connection, before nginx or the app sees the request, and it follows the machine: servers A and B (built by `recover.sh` in `e07-07` and `e07-08`) had about 1.5% of connects taking an extra 50–60 ms even when idle and with no HTTP involved; servers built in `e07-06` and `e07-09` did not. Server answer time stayed about 3 ms on all of them. Stage 8's change (a column, a takedown endpoint, a `410` branch in redirects) cannot affect TCP connects. Most likely cause: network placement of some Hetzner hosts (not established further; the slow machines were deleted by the runs themselves).
