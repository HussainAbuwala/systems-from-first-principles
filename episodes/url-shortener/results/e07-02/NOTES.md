# e07-02: E07 Machine lost, against stage 6 attempt 2

**Verdict: FAIL on click counts only (expected; accepted failure extended to machine loss, decided by the user 2026-10-05). Every E07 rule passes:** back 204 s after the delete command (limit 3,600 s); 822 links confirmed before the loss, none lost, none redirecting to the wrong page.

**System:** stage 6 attempt 2 (a new link or name is confirmed only once Litestream has copied it to the Volume) on `sfp-app` (CX33, nbg1), 10 M links reseeded before the run, Better Stack monitor `5022545`. E02 traffic (100 redirects/s, 2 creates/s) for 18 minutes from `sfp-load` (CPX42). `MACHINE_LOST_AFTER=420`, recovery started on the Better Stack incident (no human reaction time), `RECOVER_TYPE=cx33`, `CHECK_COUNTS=1`. Deployed version on the old server `cddd204` (clean); the rebuilt server stamped itself `cddd204-dirty` only because the spend ledger had changed mid-run (fixed in `deploy.sh` afterwards).

| Rule | Result | Pass |
| --- | --- | --- |
| Service back within 1 hour | 204 s after the delete command | PASS |
| At most the last 5 minutes of confirmed links lost | 0 lost of 822 confirmed before the loss (600 in its last 5 minutes) | PASS |
| No wrong answer served | 0 links redirect to the wrong page; 0 wrong redirects during the run | PASS |
| Redirect p99 / create p99 outside the outage | 10.4 / 60.4 ms | PASS |
| Errors outside the outage | 0.0% | PASS |
| Click counts within 1% (E05) | 1 of 1101 links outside 1%; 40429 vs 40390 clicks (sent vs server) | FAIL (accepted) |

**Timeline after the delete command (18:05:55 UTC):** old server's last answer +3 s · Better Stack incident +78 s ("Timeout (no headers received)") · recovery started on seeing it · `recover.sh` 132 s (see `recovery.log`) · first successful redirect +204 s. `alert_seen_to_recovery_start_seconds` shows -1: the start time is recorded in whole seconds and the alert time to a tenth, so it is rounding, not a negative delay.

**Create time:** p99 60.4 ms, against 15.5 ms in `e07-01` (attempt 1, which did not wait for the copy): waiting for the copy to the Volume adds tens of milliseconds to the slowest creates, inside the 300 ms rule.

**Other notes:** the lost machine's resource record went with it; `metrics-sfp-app.csv` covers only the rebuilt server.
