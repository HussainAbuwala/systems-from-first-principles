# Stage 07: Counter jump and heartbeat

Status: **done** (2026-10-07). E08 passes on attempt 2 (`e08-07`, `e08-08`, `e08-09`); every earlier event rerun.

## Trigger

- **Event:** E08 (Load): 10% of Bitly: 1,000 redirects/s, 20 creates/s, 100 million links stored.
- **Failed run:** `results/e08-01/` (stage 6): create p99 753.1 ms against 300 ms; everything else passes (redirect p99 17.8 ms, 0% errors, all links and counts correct).
- **What the user would notice:** creating a short link usually takes a blink, but now and then most of a second, sometimes more.

## Diagnosis

**Confirmed by a diagnostic repeat (`e08-02`, Litestream's CPU recorded):** the 1-second creates come from Litestream rewriting its whole 1.7 GB copy (a compaction of the first full copy; it recurs after every fresh copy, i.e. each reseed and each restore, at the first hourly merge and with the daily full copy). During it Litestream used 120–135% of a core and wrote 19–25 MB/s to the Volume, and each create's small copy waited behind it (not on a lock: checked in Litestream's source). In steady operation create p99 was about 150–180 ms, under the limit.

Earlier reading from `e08-01`: every create waits for its own copy to the Volume (stage 6 attempt 2), and those copies go through Litestream one at a time. At 20 creates/s Litestream wrote 3,082 small change files in 5 minutes; create p99 rose as they piled up, and spiked to 1–1.5 s when Litestream reorganised its 1.7 GB copies (disk reads up to 17 MB/s, writes up to 36 MB/s, in exactly those windows). Node, nginx, overall CPU and disk wait all had room. See `results/e08-01/NOTES.md`.

## Options considered

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| A. One copy for every create waiting at that moment ("group commit") | While a copy is in progress, newly arriving creates wait for the next one, which confirms all of them together: 20 copies a second become a few, and far fewer small files and less Litestream CPU | A small change in the app; a create may wait for up to about two copies; **may not remove the spikes**, which come from the big rewrite | pending |
| B. Change Litestream's merge schedule (`levels`), so the whole copy is rewritten less often | Fewer of the big rewrites that cause the spikes | Departs from Litestream's defaults; cannot remove the rewrite after a fresh copy or the daily full copy; change files pile up more between merges | pending |
| E. Accept, in the open: slow creates (up to about 1.5 s) for a few minutes after each fresh copy and around the daily full copy | — | The run stays FAIL on create p99; a performance failure, not a lost or wrong link, so it may be accepted | pending |
| C. Stop waiting for the copy; jump the code counter after a restore | Creates as fast as before stage 6 attempt 2 | Reopens the custom-name hole (a name lost in the last second can be registered by someone else) | pending |
| D. Bigger server | — | The queue through Litestream is one at a time; CPU and disk were not full | No |

**Chosen by the user (2026-10-06): counter jump, custom names keep waiting.** Set aside after discussion: the receipt disk (a second small Volume holding a receipt for every new link and name, replayed after a restore: no loss at all and fast creates, but more code and a second mechanism), tidying up less (restores read many more files; small benefit once links stop waiting), random row numbers (work without an extra index, but scatter new links through the table; no help for names), copying to Object Storage (uncertain), and a copy-lag check in `/health` (declined for now).

**What this gives up, stated plainly:** stage 6 lost no confirmed link when the machine was lost. With the counter jump, links confirmed in the machine's last moment before Litestream's next copy (normally about a second) are lost and answer 404, which E07's 5-minute recovery point allows; their codes are never reissued. Names still never lose a confirmed name. **Assumption not in the traffic model:** custom names are a small share of creates (E08's load has none; E03 saves about 3 a second); if names became busy they would slow down during Litestream's big rewrites. Next move then: the receipt disk. Also: without a copy-lag check, a stopped Litestream would go unnoticed while links keep being confirmed.

## Change

- `system/server.ts`: a generated link is confirmed once it is on the server's disk (no wait for Litestream); a custom name still waits for Litestream's copy and is removed with a 503 if the copy fails; a link with an empty URL (the placeholder) answers 404.
- `system/jump.ts` (new): inserts a placeholder (empty URL) at the highest restored link + 1,000,000 and prints the highest restored link, how old the newest real link is, and the next number. A million covers more than an hour of confirmed links even at about 200 a second, the disk-bound save rate measured in `e03-01`/`e05-01` before WAL mode (the WAL-mode ceiling is probably higher and not yet measured).
- `system/deploy.sh`: after a real restore (no database before, database after), runs `jump.ts` before the app starts. Not after a power cut (nothing confirmed is lost then) or a normal deploy.

**First check (2026-10-06, not a judged run):** the 100 M copy restored to a scratch file on `sfp-app` in **177 s** (about 20 s at 10 M); `jump.ts` on it: highest restored link 100,007,160, placeholder 101,007,160, and the next inserted link got 101,007,161.

## E08 on stage 7 (in progress)

| Run | Create p99 | Redirect p99 | Errors | Counts | Verdict | First minute (warm-up) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `e08-03` | 42.3 ms | 32.3 ms | 0% | 2 links over by 1–2 | FAIL (counts) | stall: p99 10 s, 6.6% errors |
| `e08-04` | 28.0 ms | 17.8 ms | 0% | exact | PASS | smooth: p99 11 ms, 0% errors |
| `e08-05` | 27.8 ms | 19.3 ms | 0% | exact | PASS | smooth: p99 13 ms, 0% errors |
| `e08-06` (investigation, load 20 min after the copy) | 30.8 ms | 18.8 ms | 0% | exact | PASS | smooth |

**Creates are fixed** (stage 6: 753–848 ms). The runs disagree on counts, so the verdict is INCONSISTENT until explained:

**The start-of-run stall, diagnosed (runs `e08-01` to `e08-03`, not `e08-04`).** For 15–20 s Node used 0% CPU while nginx turned connections away and Litestream used over two cores; at 10:17:08 the app logged `database is locked` (its once-a-second click save gave up after the 5 s `busy_timeout`). Litestream's source (v0.5.17, `checkpointWithExecutor`): even its PASSIVE checkpoint first takes the database's write lock (a write to `_litestream_lock`) while it copies the latest WAL changes. Normally that is milliseconds. **Corrected by the investigation (`e08-06`):** the slow part is not the disk but a check inside the checkpoint, `lastPageMatch`, which decodes the most recent LTX file page by page while the lock is held; right after a fresh full copy with no writes since, that file is the whole 1.7 GB copy, so the lock is held for about 30 s of CPU work. (The earlier reading, "the disk is saturated", was wrong.) The app's saves (click counts, new links) are synchronous on Node's only thread, so waiting for that lock stops every request, redirects included. Clicks that timed out on the client (10 s) but were later answered were counted by the server: the over-counts. In `e08-04` Litestream's heavy phase (217% CPU) finished at the very start of the run and nothing stalled: the stall depends on timing.

**Why it matters beyond the warm-up:** the same happens after every fresh full copy, i.e. **after every recovery from a machine loss**, and possibly around the daily full copy and the first hourly merge (not yet observed under load).

## Attempt 2: heartbeat

**Why the runs differed (all of them):** it is a race after each fresh full copy between the first save (a click-count batch once traffic arrives) and Litestream's first fold. If the fold comes first, the newest LTX file is still the full copy and the check scans it for about 30 s holding the lock (`e08-01`, `e08-02`, `e08-03` froze, gaps of about 33, 20 and 21 s between the copy finishing and the run starting); if traffic comes first, the check reads a small file (`e08-04`, `e08-05`, gaps of about 18 and 20 s). The fold's timing varies by several seconds, hence the same gap gave different results.

**Change (`fc2a12c`):** the once-a-second save in `system/server.ts` always happens and updates a one-row `heartbeat` table (when busy it rides along with the click-count save; when quiet it is the only change). Litestream therefore writes a small change file every second (196 bytes when idle), so the first save after a full copy always comes within a round of it. Cost: one tiny save per second when quiet; nothing extra when busy.

**Alternatives considered:** fixing the check inside Litestream (the LTX format has a page index, `ltx.DecodePageIndex` in `superfly/ltx` v0.5.2, so the page could be looked up directly instead of scanning; the clean fix, but it means patching or reporting upstream); `checkpoint-interval: 0` (no time-based folds; a size-triggered fold right after a full copy under heavy traffic could still scan); a readiness gate after recovery (wait for the first fold before admitting visitors; does not help the daily full copy); the dedicated writer thread (contains freezes but writes would still wait 30 s; kept for a later level). No setting turns the check off (`skip-verify` concerns S3 TLS).

**Probe test (`results/heartbeat-probe-01/`):** same quiet scenario as `e08-06`: no hold of 500 ms or more in 12 minutes (5 isolated checks of 2,880 found the lock taken, each under 250 ms), against 30.5 s without the heartbeat. Remaining theoretical gap, not observed: a fold triggered at the very end of the full-copy round, before the next round turns the heartbeats into a small file.

## E08 on the final design (attempt 2)

Traffic started about 20 s after each fresh full copy finished (the timing that froze `e08-01` to `e08-03`). Combined: `results/verdicts/E08-stage-07.json`.

| Run | Create p99 | Redirect p99 | Errors | Counts | First minute (warm-up) | App lock waits |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| `e08-07` | 39.6 ms | 18.7 ms | 0% | exact | p99 8.8 ms, 0% errors | 0 |
| `e08-08` | 22.3 ms | 14.5 ms | 0% | exact | p99 9.6 ms, 0% errors | 0 |
| `e08-09` | 20.0 ms | 13.7 ms | 0% | exact | p99 8.8 ms, 0% errors | 0 |

**Resources during E08 (after warm-up):** server CPU about 52% on average (peaks 65–66%, busiest core up to 82%): nginx (TLS for 1,000 new connections/s) about 1.2 cores, Litestream about 0.5 cores on average and up to 1.4 during its whole-copy merges, Node about a quarter of a core. Load generator under 46% (valid). The 12 GB database does not fit in about 7 GB of page cache; redirects still p99 under 19 ms.

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | `e01-09` | 11.6 ms (create 9.2 ms) | 0% | yes; counts exact | PASS |
| E02 | `e02-09` | 7.5 ms (create 10.9 ms) | 0% | yes; counts exact | PASS |
| E03 | `e03-15` | 33.7 ms (create 30.2 ms) | 0% | exactly one winner in all 1,001 rounds; counts exact | PASS |
| E04 | (covered by E05) | 6.3 ms | 0% | yes | PASS |
| E05 | `e05-08` | 6.3 ms (create 12.3 ms) | 0% | counts exact (1,355,748 = 1,355,748) | PASS |
| E06 | `e06-06` | 7.7 ms | 0% | no confirmed link lost (checker 0 problems); back 61 s after the power cut; 8 of 1,101 links' counts short | **PASS** except counts (accepted) |
| E07 | `e07-06` | 7.5 ms | 0% | back 340 s after the delete command (detection 215 s, `recover.sh` 134 s); 821 links confirmed before the loss, **2 lost** (confirmed in the old server's last moment; answer 404, allowed) and **0 redirecting to the wrong page**; counter jumped from 10,000,819 to 11,000,820; 17 of 1,101 links' counts short | **PASS** except counts (accepted) |
| E08 | `e08-07`, `e08-08`, `e08-09` | 18.7 / 14.5 / 13.7 ms | 0% | counts exact | PASS |

## Accepted failures (unchanged)

A power cut or the loss of the machine can lose up to about a second of click counts (E06 and E07 runs recorded FAIL on the per-link 1% rule). Stage 7 also gives up stage 6's "no confirmed link lost" on machine loss, within E07's rule: links confirmed in the machine's last moment are lost and answer 404; their codes are never reissued.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07 | Stage 6, but generated links confirmed on the server's disk with a counter jump after any restore; names still wait for the copy; a heartbeat save every second | E08: 1,000 redirects/s, 20 creates/s, 100 M links (12 GB, larger than memory) | 14.5 ms (median of 3; creates 22.3 ms) | 0% | 12 GB | €8.49 + €0.50 IPv4 + €0.57 Volume = €9.56 (Better Stack free) | not yet broken; next is E09. Closest to a limit in E08: CPU about 52% (nginx TLS about 1.2 cores, Litestream up to 1.4 during whole-copy merges). Accepted: about 1 s of click counts in a power cut or machine loss; links confirmed in the last moment before a machine loss |

## Interview line

"At 100 million links, waiting for every new link to reach the backup cost up to 0.8 s while the backup tool rewrote itself, so we confirm links on local disk and jump the code counter after any restore so a lost code is never reused; the backup tool's own safety check could then still lock the database for 30 s after a fresh copy, which a one-row heartbeat write every second prevents."
