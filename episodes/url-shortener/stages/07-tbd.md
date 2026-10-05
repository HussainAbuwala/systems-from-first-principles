# Stage 07: (name when chosen)

Status: **diagnosed, waiting on the user's choice of fix** (2026-10-05).

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
