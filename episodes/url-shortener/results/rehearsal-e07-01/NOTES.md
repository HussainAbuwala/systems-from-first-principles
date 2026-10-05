# rehearsal-e07-01: E07 rehearsal on a spare server (not a judged run)

**Purpose:** check the stage 6 scripts and the E07 tooling end to end before they touch `sfp-app`. Not an episode result: small machines, small database, light load.

**Setup:** `sfp-rehearsal` (CX23, nbg1) with its own kept Primary IPs, a 10 GB protected Volume and a temporary Better Stack monitor (`5022589`, every 30 s); 10,000 seeded links (`reset-and-seed.sh`, sample 1,000). Load from `sfp-rehearsal-load` (CX23): 20 redirects/s, 1 create/s, 14 minutes. `MACHINE_LOST_AFTER=150`, `RECOVER_TYPE=cx23`, no click-count check.

**Timeline (UTC, 2026-10-05):**

| Moment | Time | After the loss |
| --- | --- | ---: |
| Server deleted (`delete.sh`) | 15:59:53 | 0 s |
| Better Stack opened its incident ("Timeout (no headers received)") | 16:01:31 | 98 s |
| Recovery started (incident seen) | 16:01:33 | 100 s |
| `recover.sh` finished: `/health` and 20 seeded links correct | 16:03:29 | 216 s |
| First successful redirect seen by the load generator | — | 206 s |

`recover.sh` took 116 s: create with kept IPs and Volume 42 s, base software 10 s, deploy and restore 53 s (restore 1 s), checks 9 s.

**Verdict from the judge: PASS.** Back 206 s after the loss (limit 3,600 s). 137 links confirmed before the loss, the last one 1.0 s before it; none lost. Outside the outage: redirect p99 13.3 ms, create p99 22.7 ms, 0% errors, 0 wrong redirects; checker: 1,639 links, 0 problems.

**What the rehearsal taught:**
- **Detection took 98 s, not about 30 s.** A deleted server's address does not answer at all, so each check waits out Better Stack's 30 s request timeout before counting as failed, and Better Stack confirms from more than one region before opening the incident. A shorter request timeout would detect sooner.
- **The 5-minute rule was not really exercised.** The loss came 150 s into the run, so every confirmed link was inside the allowed last 5 minutes. A real run must lose the machine more than 5 minutes after links start being created, so that older links exist and must survive.
- The new reset script and the deploy script on a fresh server with an empty Volume ("no matching backups found", then a new database) both worked.
- Resource records of the lost machine are gone with it; `metrics-sfp-rehearsal.csv` covers only the rebuilt server.

**Clean-up:** both servers deleted (ledger), Volume protection switched off and Volume deleted, both Primary IPs and the temporary monitor deleted. Cost: €0.0176 for the two servers plus pennies for the Volume and IPs.
