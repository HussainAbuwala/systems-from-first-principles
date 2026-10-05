# e07-01: E07 Machine lost, against stage 6

**Verdict: FAIL.** One link confirmed in the old server's last moment was lost (allowed: within the last 5 minutes), and after recovery its code was issued again to a different link, so the code now redirects to the wrong page. A wrong answer is never allowed. Click counts also fell short (expected; see below). Recovery itself passed easily. One run: a correctness failure counts after one run, so runs 2 and 3 were not started.

**System:** stage 6 (`b11191b` and later tooling) on `sfp-app` (CX33, nbg1), 10 M links reseeded before the run, Litestream copying to Volume `sfp-app-copy`, Better Stack monitor `5022545` every 30 s. E02 traffic (100 redirects/s, 2 creates/s) for 18 minutes from `sfp-load` (CPX42). `MACHINE_LOST_AFTER=420`: the delete command started 420 s into the run; recovery started as soon as Better Stack's incident appeared (no human reaction time); `RECOVER_TYPE=cx33`; `CHECK_COUNTS=1`.

| Rule | Result | Pass |
| --- | --- | --- |
| Service back within 1 hour | First successful redirect 191 s after the delete command | PASS |
| At most the last 5 minutes of confirmed links lost | 822 links confirmed before the old server stopped; 1 lost (`…/e07-01/9-822`, code `FXFB`, confirmed 5 s after the delete command started, in the server's last second) | PASS |
| No wrong answer served | **`FXFB` was issued again 191 s after the loss, to `…/e07-01/511-1179`**; it now redirects there | **FAIL** |
| Redirect p99 / create p99 outside the outage | 10.0 / 15.5 ms | PASS |
| Errors outside the outage | 0% | PASS |
| Click counts within 1% (E05) | 6 of 1,101 links outside 1%; checked links 41,065 sent vs 41,006 on the server (59 short) | FAIL (expected: accepted failure to be extended) |

**Timeline after the delete command (s):** old server's last answer +5 (it confirmed 11 more links in those 5 s; 10 reached the copy) · Better Stack incident +72 ("Timeout (no headers received)") · recovery started +77 · `recover.sh` done +201 (create 31 s, base software 10 s, deploy and restore 72 s of which the restore step 22 s, checks 9 s) · first successful redirect +191 (the app was serving before `recover.sh` finished its own checks).

**Why the code was reissued.** Litestream sends changes about once a second, so the newest link confirmed by the old server never reached the copy. That loss is allowed. But codes are calculated from a counting-up row number: after the restore, SQLite's next number was the lost link's number, so the next new link received the same code. This is the same trap as `e06-01` (stage 4), where a rolled-back save led to a reissued code; stage 5's fix (`synchronous=EXTRA`) closed it for power cuts because nothing confirmed is lost there, but losing a machine always loses the last moment before the copy.

**Judge correction (made after this run, in the open).** The first judgement (`verdict-first-judge.json`) took the loss as the moment the delete command started. Deletion takes a few seconds, and the server kept confirming links meanwhile, so `FXFB` counted as lost "after the loss", outside the allowed window. The judge now takes the loss from visitors' view, the old server's last successful redirect (as for E06), and separates a lost link (404, allowed if confirmed in the last 5 minutes) from a link redirecting to the wrong page (never allowed). The verdict stays FAIL, now for the wrong page. `check.py` now records every problem in full. E06 judging is unchanged (`e06-02` re-judged identically).

**Click counts.** Up to about a second of clicks lives only in memory or in the not-yet-copied log when the machine disappears; every mismatch was the server below the truth (worst: 2 short on links with fewer than 200 clicks). Same cause as the power-cut accepted failure; the user agreed (2026-10-05) to extend that accepted failure to machine loss if it showed up.

**Other notes:** the old machine's resource record was lost with it; `metrics-sfp-app.csv` covers only the rebuilt server. The kept IPs stayed `auto_delete=false` and protected after the rebuild. Load machine deleted after this run.
