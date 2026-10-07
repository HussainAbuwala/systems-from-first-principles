# e09-01: E09 Takedowns, pre-run against stage 7 (before the feature exists)

**Verdict: FAIL, as expected:** stage 7 has no takedown endpoint, so all 101 takedown requests were answered 404 and none was confirmed. Purpose: prove the new E09 tooling end to end (takedown schedule in `level.js`, judge rules, checker expecting 410 for taken-down links, operator secret passed as a private file and absent from `run.json`) and record the starting point.

Everything else passed at E08 load with 100 M links: redirect p99 16.4 ms, create p99 26.8 ms, errors 0.033% (the 101 refused takedowns), counts exact (99,448 = 99,448), no redirect lets browsers reuse it.

Tooling note: the arrival-rate schedule started 101 takedown iterations for `TAKEDOWNS=100`; capped at 100 afterwards.
