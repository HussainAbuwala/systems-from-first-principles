# e07-05: E07 Machine lost, against stage 6 attempt 3 (final design)

**Verdict: FAIL on click counts only (accepted failure, extended to machine loss by the user 2026-10-05). Every E07 rule passes:** back 352 s after the delete command (limit 3,600 s); 824 links confirmed before the loss, none lost, none redirecting to the wrong page; 0% errors outside the outage; redirect p99 10.3 ms, create p99 66.8 ms.

**System:** stage 6 attempt 3 on `sfp-app` (CX33, nbg1), 10 M links reseeded before the run; app code as attempt 2 (`server.ts` unchanged since `5ac4ec1`). The old server had been built at 19:22 UTC while moving back from the emergency CPX32, before `recover.sh`'s fallback was committed, so it stamped `f5621fb-dirty` (only `recover.sh` differed). E02 traffic for 18 minutes from `sfp-load` (CPX42); `MACHINE_LOST_AFTER=420`, `RECOVER_TYPE=cx33`, `CHECK_COUNTS=1`.

**The retry path ran for real:** the first CX33 request failed (`resource_unavailable`); `recover.sh` asked again 60 s later and got a CX33, so no fallback type was needed. Recovery script 190 s (create including the wait 96 s, base software 10 s, deploy and restore 73 s of which restore 25 s, checks 9 s).

**Timeline after the delete command:** old server's last answer +5 s · Better Stack incident +168 s (slower than the 72–98 s of earlier runs) · recovery started on seeing it · first successful redirect +352 s.

**Counts:** 2 of 1,101 links outside 1%; 33,511 sent vs 33,466 on the server.

**Counted with `e07-02` and `e07-03`** (attempt 2, identical except for `recover.sh`'s retry and fallback, which those runs did not need) as the three E07 runs of the final design, by the user's decision to save time (2026-10-05).
