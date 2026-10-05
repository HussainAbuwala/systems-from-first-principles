# e06-02, e06-03, e06-04: E06 Power cut, against stage 5

**Combined verdict: FAIL on the count rule only, which is an accepted failure (won't fix); every other E06 rule passes in all three runs.** The judge's verdict file says FAIL because the count rule is unchanged; see `stages/05-durable-saves.md`.

Deployed `url-shortener/stage-05` (`synchronous=EXTRA`, confirmed by the startup log) on `sfp-app` (CX33, nbg1), 10 M links. E02 traffic for 8 minutes; hard power cut about 150 s in, powered on 30 s after the command completed.

| Rule | e06-02 | e06-03 | e06-04 | Pass |
| --- | ---: | ---: | ---: | --- |
| Confirmed links lost (every link created during the run checked) | 0 of 827 | 0 of 841 | 0 of 839 | **PASS** |
| Outage seen by visitors (rule: back within 5 minutes) | 67 s | 60 s | 60 s | **PASS** |
| Redirect p99 outside the outage | 13.4 ms | 16.1 ms | 13.8 ms | **PASS** |
| Errors outside the outage | 0% | 0% | 0% | **PASS** |
| Links whose count was more than 1% off | 7 of 1,101 | 30 of 1,101 | 7 of 1,101 | FAIL, **accepted** |

**Was the risky window exercised?** On stage 4 (`e06-01`) the lost link had been confirmed about 1 s before the outage. In each stage 5 run, 10–11 links were confirmed in the last 5 seconds before the outage (inside ext4's few-second window for writing the journal deletion), and the last one within 0–1 s of it. None was lost.

**Counts:** every mismatch was the server below the truth, from the up-to-one-second tally lost with memory; checked links' totals were 28, 42 and 18 clicks short.
