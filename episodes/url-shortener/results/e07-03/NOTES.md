# e07-03: E07 Machine lost, against stage 6 attempt 2

**Verdict: FAIL on click counts only (expected; accepted failure extended to machine loss, decided by the user 2026-10-05). Every E07 rule passes:** back 201 s after the delete command (limit 3,600 s); 821 links confirmed before the loss, none lost, none redirecting to the wrong page.

**System:** stage 6 attempt 2 (a new link or name is confirmed only once Litestream has copied it to the Volume) on `sfp-app` (CX33, nbg1), 10 M links reseeded before the run, Better Stack monitor `5022545`. E02 traffic (100 redirects/s, 2 creates/s) for 18 minutes from `sfp-load` (CPX42). `MACHINE_LOST_AFTER=420`, recovery started on the Better Stack incident (no human reaction time), `RECOVER_TYPE=cx33`, `CHECK_COUNTS=1`. Deployed version `24ff386`; the rebuilt server again stamped `-dirty`, because the first fix's exclusion pattern missed files inside results folders (the reseeded sample); fixed in `239fd32`. Code identical either way.

| Rule | Result | Pass |
| --- | --- | --- |
| Service back within 1 hour | 201 s after the delete command | PASS |
| At most the last 5 minutes of confirmed links lost | 0 lost of 821 confirmed before the loss (602 in its last 5 minutes) | PASS |
| No wrong answer served | 0 links redirect to the wrong page; 0 wrong redirects during the run | PASS |
| Redirect p99 / create p99 outside the outage | 9.3 / 62.6 ms | PASS |
| Errors outside the outage | 0.0% | PASS |
| Click counts within 1% (E05) | 3 of 1101 links outside 1%; 40226 vs 40200 clicks (sent vs server) | FAIL (accepted) |

**Timeline after the delete command (18:27:41 UTC):** old server's last answer +3 s · Better Stack incident +83 s ("Timeout (no headers received)") · recovery started on seeing it · `recover.sh` 125 s (see `recovery.log`) · first successful redirect +201 s. `alert_seen_to_recovery_start_seconds` shows -1: the start time is recorded in whole seconds and the alert time to a tenth, so it is rounding, not a negative delay.

**Create time:** p99 62.6 ms, against 15.5 ms in `e07-01` (attempt 1, which did not wait for the copy): waiting for the copy to the Volume adds tens of milliseconds to the slowest creates, inside the 300 ms rule.

**Other notes:** the lost machine's resource record went with it; `metrics-sfp-app.csv` covers only the rebuilt server.
