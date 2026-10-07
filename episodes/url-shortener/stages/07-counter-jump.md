# Stage 07: Counter jump

Status: **built** (2026-10-06); E08 and reruns to come.

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
