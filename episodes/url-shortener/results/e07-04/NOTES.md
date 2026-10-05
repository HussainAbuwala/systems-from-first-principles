# e07-04: E07 Machine lost, against stage 6 attempt 2

**Verdict: FAIL.** The automated recovery failed: Hetzner had no CX33 available ("error during placement (resource_unavailable)"), and `recover.sh` tried once and stopped, so the service was not back before the load stopped. Done by hand afterwards, as an operator would: recovered onto a CPX32 (the closest available type), links back **15.5 minutes after the loss**, inside the 1-hour rule but outside the automated run. **No confirmed link lost:** all 823 links confirmed before the loss resolve correctly; none redirects to the wrong page. Click counts short (accepted failure).

**System:** as `e07-02`/`e07-03`; deployed version `239fd32` (clean). E02 traffic for 18 minutes; `MACHINE_LOST_AFTER=420`, `RECOVER_TYPE=cx33`, `CHECK_COUNTS=1`.

**Timeline (UTC, 2026-10-05):**

| Moment | Time | After the loss |
| --- | --- | ---: |
| Delete command; old server's last answer 3 s later | 18:49:29 | 0 s |
| Better Stack incident ("Timeout (no headers received)") | 18:50:43 | 74 s |
| `recover.sh` started, failed 3 s later: CX33 `resource_unavailable` | 18:50:44 | 75 s |
| Load stopped (end of the 18-minute run); count check then timed out against the missing server | 19:00:40 | |
| Checked by hand: CX33 unavailable in fsn1, nbg1 and hel1; nearest available x86 type with 4 vCPU / 8 GB: CPX32 (€35.49/month against €8.49) | 19:02:46 | |
| `recover.sh sfp-app … cpx32` started by hand | 19:02:59 | 13.5 min |
| `/health` and 20 seeded links correct on the rebuilt server (restore step 16 s, script 118 s) | 19:04:57 | 15.5 min |

**After recovery (by hand, same commands as `run-event.sh`):** count check: 19 of 1,101 links outside 1% (19,577 sent vs 19,516 on the server; more small links outside 1% than in other runs because the load stopped during the outage, so links have fewer clicks); link checker: 1,823 links, 0 problems; judge.

**Judge correction (in the open).** The first judgement (`verdict-before-open-outage-fix.json`) reported "back after 4 s" and 65% errors: with no successful redirect after the loss, it picked a small gap just before the loss and counted the open outage as errors. The judge now recognises an outage still open when the load stops. `e06-02` and `e07-01`–`e07-03` re-judged identically.

**What this run taught:** recovery depends on the provider having the machine type at that moment. `recover.sh` needs to fall back to a similar type, and the stage's cost depends on which type is available. The data side held: the Volume and the kept IPs waited unattached, and nothing confirmed was lost.

**Other notes:** `sfp-app` now runs on a CPX32 (server id in Hetzner changed again). The lost machine's resource record went with it, and no record exists for the rebuilt one during the run (it was built after the load stopped).
