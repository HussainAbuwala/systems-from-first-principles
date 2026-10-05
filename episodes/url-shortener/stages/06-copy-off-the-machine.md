# Stage 06: Copy off the machine

Status: **done** (2026-10-05). E07 passes on attempt 3 (`e07-02`, `e07-03`, `e07-05`); every earlier event rerun.

## Trigger

- **Event:** E07 (Failure): under E02 load the server and its disk are deleted for good. Rules: service back on a new machine within 1 hour; at most the last 5 minutes of acknowledged links lost.
- **Failed run:** none. Stage 5 fails E07 by construction, so no run was paid for (checked through the Hetzner API on 2026-10-05):
  - the only copy of `links.db` is on `sfp-app`'s own disk;
  - Hetzner backups are off (no backup window), and the account has no Volumes and no snapshots;
  - the server's IPv4 address is set to `auto_delete=true`, so it would be deleted with the server. Every short link handed out contains that address, so even a perfect copy of the data would leave all existing links pointing nowhere.
- **What the user would notice:** every short link stops working, permanently. Nothing to restore from.

## Diagnosis

No resource ran out. The design has a single copy of the data and a single, disposable address, both tied to one machine.

## Attempts that failed

| Attempt | Why it was plausible | What failed (run ID) | Lesson |
| --- | --- | --- | --- |
| 1. Litestream copying in the background (every second), app confirming a link once it is on the server's own disk | Litestream's documented setup; a second of loss is well inside the 5-minute rule | `e07-01`: recovery passed (back 191 s after the delete command), but the link confirmed in the old server's last second never reached the copy, and after the restore its code (`FXFB`) was issued again to a new link, so it redirects to the wrong page | Same trap as `e06-01`: counting-up codes turn a lost row into a reissued code. Losing the newest links is allowed; reissuing their codes never is. Custom names have the same hole (a lost name can be registered by someone else) |
| 2. Attempt 1, but a new link or name is confirmed only once Litestream has copied it to the Volume | Nothing confirmed can then be lost, so nothing can be reissued; same tool, no extra cost | `e07-02`, `e07-03` passed every E07 rule; `e07-04`: **Hetzner had no CX33 anywhere in Europe** and `recover.sh` stopped after one try; recovered by hand onto a CPX32 15.5 minutes after the loss, no confirmed link lost | Recovery depends on the provider having the machine type at that moment |

## Options considered

Two separate choices: what carries the copy (the courier) and where it lives (the destination). Prices checked on Hetzner's own pages and API on 2026-10-05, excluding VAT.

**Courier**

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| Hetzner daily backups | A copy off the disk | 20% of the server price (€1.70/month) | No: once a day, far past the 5-minute rule, and deleted together with the server |
| Periodic full copies (SQLite's safe-copy command, every few minutes) | A copy within minutes | Resends the whole database every time, heavy at E08's size; in the current rollback mode a long read blocks writes, so creates would stall during each copy (not measured) | No: probably needs WAL mode anyway, and loses minutes rather than about a second |
| `sqlite3_rsync` on a schedule | Sends only changed pages | Needs WAL mode and a machine at the other end that can run it; newer, less used; loss up to the gap between runs | No |
| **Litestream** (continuous, changes only) | A copy about a second behind; restore to any moment within its history | One more program on the server; SQLite must switch to WAL mode (E06 must be rerun) | **Yes**: barely bigger than a scheduled job, and light as the data grows |
| Live second server | Takeover in seconds, almost no loss | A second server every month plus failover machinery | No: E07 allows an hour |

**Destination**

| Option | What it is | Cost for us | Chosen? Why |
| --- | --- | --- | --- |
| Database itself on a Volume | The live file on a network disk that outlives the server | about €0.57/month | No: still the only copy; the disk holding the data is what E07 deletes |
| **Copy on a Volume** | Block storage: SSDs, every block on three servers; attaches to one server at a time, same location only | €0.0572 per GB-month, 10 GB minimum: about €0.57/month | **Yes**: the smallest and cheapest option that passes |
| Storage Box (BX11) | File storage: one server's hard drives in RAID, reached over SFTP; snapshots; can be in another city | €3.20/month for 1 TB, no setup fee | No, but shown as the alternative |
| Object Storage | Object storage: hard drives with erasure coding across many servers, reached by S3 web requests; can be in another city | €6.49/month base, includes 1 TB | No, but shown as the alternative |

**What the Volume gives up (stated in the video):**
- It is plugged into the server like a folder, so a mistake on the server (a wrong delete, a bad script) can reach the copy as easily as the original.
- Hetzner keeps no snapshots of Volumes. Its three copies are redundancy against broken hardware, not a backup against deletion; only Litestream's own history allows going back.
- It can only be in the same location as the server. A site-wide loss (not an event in this episode) would need the Storage Box or Object Storage in another city.

**Also decided:**
- **Detection:** a new `GET /health` that does a tiny database read, watched by an external monitoring service (set to ignore our self-made certificate), alerting by email (the free plan has no phone alerts).
- **Recovery:** started by a person after the alert, then one script: new server in nbg1, install, attach the Volume, `litestream restore`, move the IP, check known links, start copying again.
- **Address:** set the IPv4 to survive server deletion (`auto_delete=false`) so it can be moved to the new server. Primary IPs are tied to their location, which keeps recovery in nbg1 anyway.
- **Timing in E07:** recorded in three parts: deletion to alert, alert to start, start to links working. During runs, recovery starts from the monitoring service's alert, not from our own checks, so the detection time is the real one.

**Details checked (2026-10-05):**
- **Hetzner backups are deleted with their server** (API reference: "If you delete the Server, you also delete all backups bound to it"), so they would not survive E07 even if they ran often enough.
- **Deleting a server detaches, not deletes,** its Volumes and Primary IPs (API reference), except that a Primary IP with `auto_delete=true` is deleted. Volumes and Primary IPs can only be used by servers in their own location. A Primary IP can only be moved to a powered-off server, but `hcloud server create --primary-ipv4 … --volume … --automount` attaches both at creation, so recovery is one create call.
- **Volumes can be protected from deletion** (a Hetzner setting). It does not stop files on it being deleted from the server.
- **The recovered server must carry `keep=true`**, or the watchdog will delete it when its lifetime runs out.
- **`synchronous` under WAL:** SQLite documents `NORMAL` as not durable across power loss in WAL mode ("might roll back following a power loss"), and `FULL` as durable; `EXTRA` "is no different from FULL in WAL mode". Litestream's tips recommend `NORMAL`, which would reopen the E06 failure, so we keep `EXTRA` (equal to `FULL`) and say so.
- **Litestream also recommends** `busy_timeout = 5000` (it takes short write locks when it folds the WAL into the main file; our app sets no timeout, so a create would fail instead of waiting) and `wal_autocheckpoint = 0` (let Litestream do the folding, so it never misses a change).
- **Monitoring service:** UptimeRobot's free plan has 5-minute checks, no API access, and is described as for "hobby and non-profit projects". Better Stack's free plan is "free for personal projects", and has a `verify_ssl` switch, push/SMS/call alert options and a token-based API; its free-plan check interval and API access are to be confirmed after sign-up.

**User decisions (2026-10-05):** keep `synchronous=EXTRA` against Litestream's advice; Better Stack's free plan (this is a personal project; the user signs up); turn on deletion protection for the Volume.

## Change

- `system/server.ts`: `journal_mode=WAL`, `wal_autocheckpoint=0` (Litestream folds the log), `busy_timeout=5000`, `synchronous=EXTRA` kept; `GET /health` reads one row and answers 200, or 503 if the database cannot be read. Checked before redirects; as a generated code, "health" would be link 15,783,592,667.
- `system/litestream.yml`: Litestream 0.5.17 copies `links.db` to `/mnt/copy/links` (file replica) with its defaults (changes every second; it keeps recent change files 5 minutes and compacts them into larger ones, with a full snapshot daily).
- `system/deploy.sh`: mounts the server's one attached Volume at `/mnt/copy`, installs Litestream (pinned, checksum checked), refuses to run Litestream without the Volume mounted, and runs `litestream restore -if-db-not-exists -if-replica-exists` before starting the app, so a new server restores and an existing one is untouched.
- `system/reset-and-seed.sh`: also stops Litestream and removes the old copy, so the copy restarts with the new database.
- `system/recover.sh`: refuses if the server still exists; creates it with the kept IPs (`sfp-app-ipv4`, `sfp-app-ipv6`), the Volume (`sfp-app-copy`) and `keep=true`; provisions; deploys (which restores); checks `/health` and 20 seeded links the load generator never clicks.
- `tools/cloud/create.sh`: passes arguments after `--` to `hcloud server create`.
- Better Stack (free plan): monitor `5022545` "sfp-app health" checks `https://2.28.198.178/health` every 30 s from four regions (eu, us, as, au), certificate check off, 30 s timeout, alerts by email only (the free plan has no phone app, calls or texts; those are in the paid plan at $29 per person per month). It opens an incident on the first confirmed failure (`confirmation_period` 0) and needs 180 s of success to close it. Incidents are readable through the API (`/api/v3/incidents`, with `started_at`, `resolved_at` and the monitor), which is how E07 runs time detection.
- Hetzner: both Primary IPs renamed and set `auto_delete=false`, then given deletion protection (checked first on a throwaway server: a server whose IP is protected can still be deleted, and the IP stays); Volume `sfp-app-copy` (10 GB, nbg1, ext4) created with deletion protection and attached to `sfp-app`.

**Attempt 2 (after `e07-01`):** `system/server.ts` confirms a new link or name only after asking Litestream to copy to the Volume and waiting for it (`POST /sync` with `wait` on Litestream's control socket, enabled in `system/litestream.yml`); Litestream's file copy flushes the file and its folder to disk before answering (checked in its source, v0.5.17). If the copy fails, the link or name is removed and the creator gets 503 "please try again"; nobody was told its code. Redirects and click counts do not wait. Litestream's docs say built-in synchronous replication "is on the roadmap but has not yet been implemented"; the command used is meant mainly for scripts and shutdowns, so this stretches the tool, said plainly. On the server itself a create took 12–20 ms; under E02 load (`spare-e02-01`, a check on a spare server) create p99 was 44.6 ms against 15.5 ms without waiting.

**Attempt 3 (after `e07-04`, user's option A):** `system/recover.sh` asks for the stage's type (CX33) every minute for up to 20 minutes, then takes the first available of CPX32, CX43, CPX42 (x86 only, because `deploy.sh` installs the x86 Litestream package) and says to move back later. User's rule: tests run only on the stage's own type, so after `e07-04` `sfp-app` was moved back from the emergency CPX32 to a CX33 (deleted and rebuilt with `recover.sh`, 2.5 minutes). In `e07-05` the first CX33 request failed and the second, a minute later, succeeded; the fallback branch itself has not yet run for real.

**Tooling corrected along the way (all in the open, earlier verdicts re-judged identically):** the loss is taken from visitors' view (the old server's last answer, 3–5 s after the delete command), not the command; a lost link (404) is allowed only if confirmed in the last 5 minutes, a wrong-page redirect never; an outage still open when the load stops is recognised; deploys stamp a version as dirty only for code changes (results files and a tracked Python cache had made rebuilt servers look dirty).

**First check (2026-10-05, not a judged run):** Litestream's first full copy of the 1.2 GB database is a 169 MB file. A link was created, and 3 s later the copy was restored to a scratch file on the server: restore took 17 s, `integrity_check` ok, 10,001,561 links in both copy and live database, and the new link present. **Caveat:** the seeded links are almost identical (same URL text apart from the story number, same creation time), so they compress far better than real links would; a real database of this size would make a larger copy and restore more slowly. Not measured.

**Rehearsal (`results/rehearsal-e07-01/`, not a judged run):** the whole E07 path on a spare CX23 with 10,000 links: deleted at 150 s, Better Stack incident after 98 s, `recover.sh` 116 s, links back 206 s after the loss, none of 137 confirmed links lost. Lessons: detection waits out Better Stack's 30 s request timeout (a deleted server does not answer at all); real runs must lose the machine more than 5 minutes into link creation so the 5-minute rule is exercised.

## E07 on the final design

Three runs counted: `e07-02` and `e07-03` (attempt 2) and `e07-05` (attempt 3). Attempt 3 changed only what `recover.sh` does when the type is unavailable, which the two earlier runs did not need, so the user chose one new run instead of three to save time. Combined: `results/verdicts/E07-stage-06.json`.

| Run | Back after the delete command | Detection (Better Stack) | `recover.sh` | Confirmed before the loss | Lost | Wrong page | Redirect p99 | Create p99 | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `e07-02` | 204 s | 78 s | 132 s | 822 | 0 | 0 | 10.4 ms | 60.4 ms | 0% |
| `e07-03` | 201 s | 83 s | 125 s | 821 | 0 | 0 | 9.3 ms | 62.6 ms | 0% |
| `e07-05` | 352 s | 168 s | 190 s (one CX33 retry) | 824 | 0 | 0 | 10.3 ms | 66.8 ms | 0% |

Every E07 rule passes in all three. Each run is recorded as FAIL only on the E05 count rule (accepted below). Recovery started the moment Better Stack's incident appeared: a person's reaction time is not included, and in real life it is the largest unknown in the hour. Alerts are email only on the free plan.

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | `e01-08` | 12.6 ms (create 37.7 ms) | 0% | yes; counts exact | PASS |
| E02 | `e02-08` | 9.9 ms (create 61.1 ms) | 0% | yes; counts exact | PASS |
| E03 | `e03-14` | 33.4 ms (name 62.6 ms) | 0% | exactly one winner in all 1,001 rounds; counts exact | PASS |
| E04 | (covered by E05) | 8.3 ms | 0% | yes | PASS |
| E05 | `e05-07` | 8.3 ms (viral 8.2 ms, create 59.7 ms) | 0% | counts exact (1,355,531 = 1,355,531) | PASS |
| E06 | `e06-05` | 9.9 ms | 0% | no confirmed link lost (1,840 checked); recovery 60 s | **PASS** except counts (accepted) |
| E07 | `e07-02`, `e07-03`, `e07-05` | 10.4 / 9.3 / 10.3 ms | 0% | no confirmed link lost or reissued | **PASS** except counts (accepted) |

**What waiting for the copy costs:** create p99 rose from 15–37 ms on stage 5 and attempt 1 to about 58–67 ms, inside the 300 ms rule; redirects did not slow down. E06 in WAL mode lost no confirmed link, as SQLite documents for `synchronous=FULL`/`EXTRA`.

## Accepted failure: counts through a machine loss

**E05's count rule (within 1% per link) is accepted as failing through a machine loss, extending stage 5's power-cut acceptance (decided by the user, 2026-10-05).** Click counts are saved once a second and copied on Litestream's regular rounds without waiting, so losing the machine can lose up to about a second of counts (in E07 runs: 1–6 of 1,101 checked links outside 1%, all short by a few clicks). Exact counts would mean every redirect waiting for the copy.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 06 | Stage 5 in WAL mode; every new link and name confirmed only once Litestream has copied it to a protected Volume; `/health` watched by Better Stack; one-command rebuild on a new server with the kept IP | E05 (viral spike with counting) and E07 (machine lost: back 3.4–5.9 min after the loss, nothing confirmed lost) | 8.3 ms (E05) | 0% | 1.2 GB (copy on the Volume: 169 MB compressed, test data) | €8.49 + €0.50 IPv4 + €0.57 Volume = €9.56 (Better Stack free) | not yet broken; next is E08. Accepted: a power cut or machine loss can lose about 1 s of click counts |

## Interview line

"To survive losing the machine we streamed every change to a disk that outlives it and rebuilt on the same IP in four minutes; the first try still reissued the code of a link confirmed in the last second, so a link is now confirmed only once it is in the copy, which costs a create about 40 ms." 
