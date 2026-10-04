# e06-01: E06 Power cut, against stage 4

**Verdict: FAIL** on two rules: a confirmed link was lost (and its code handed to someone else), and five small links' click counts were short by one or more. Recovery time, latency and errors outside the outage all passed. One run: a correctness failure counts after one run.

**System:** `url-shortener/stage-04` on `sfp-app` (CX33, nbg1), 10 M links. E02 traffic (100 redirects/s, 2 creates/s) for 8 minutes. About 150 s after the run started, `hcloud server poweroff` (a hard power cut: no signal, no clean shutdown); powered on 41 s after the command. nginx and Node start on boot (both `enabled`).

| Rule | Result | Pass |
| --- | --- | --- |
| No acknowledged link lost | **1 of 838 confirmed links lost**: `FXwR` was confirmed for `.../e06-01/2-280` about 1 s before the power died, and after reboot the same code was issued for `.../e06-01/822-388`; it now redirects there | **FAIL** |
| Redirects working again within 5 minutes | Last successful redirect 4 s after the command, first one after it 65 s after: **61 s** outage seen by visitors | PASS |
| Redirect p99 / create p99 outside the outage (plus the 10 s client timeout) | 12.7 / 19.2 ms | PASS |
| Errors outside the outage | 0% | PASS |
| Click counts within 1% (E05, "through the E06 power cut") | **5 of 1,101 links outside 1%**; checked links' total 19,879 on the server against 19,902 sent (23 short) | **FAIL** |
| Wrong destinations other than `FXwR` | 0 | — |

**Why the link was lost (SQLite's documented durability gap).** The database runs SQLite's defaults: `journal_mode=DELETE`, `synchronous=FULL` (checked on the server). In that mode a transaction commits by deleting its journal file, and the deletion itself is not synced to disk. SQLite's documentation: "FULL is not necessarily durable across a power loss in rollback mode … it is possible that a single transaction that commits right before a power loss might get rolled back upon reboot. The database will not go corrupt. But the last transaction might go missing … if EXTRA is not set." The insert of `FXwR`, committed about a second before the cut, was rolled back on reboot.

**Why the loss became a reused code.** Codes are calculated from a counting-up row number. With the row gone, SQLite handed the same number to the next new link after reboot, so a durability gap turned into two creators being told they own the same short link. With random codes the first link would still have been lost, but the code would not have been reissued.

**Why the counts were short.** As predicted: up to about a second of counts lives only in memory between saves, and the power cut erased it. Every mismatch was the server below the truth; links with fewer than 100 clicks must be exact, so losing a single click fails them.

**Power-cut side effect in our own tooling.** The resource recorder's log on `sfp-app` ended with 377 zero bytes: the file's length had been updated but its last data never reached the disk. The analyser crashed on it and stopped the run script before the count check, link checker and judge; those were run by hand afterwards with the same steps, and the analyser now skips damaged lines. The recorder's last intact line is 2 s before the cut; there is no resource data for the rest of the run.

**Judge correction.** The first judgement measured recovery from when the power-off command was sent (reporting 1 s, because the machine kept serving for a few seconds). The outage is now taken from visitors' view: the longest gap in successful redirects around the command.
