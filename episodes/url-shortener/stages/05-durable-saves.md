# Stage 05: Durable saves

## Trigger

- **Event:** E06 (Failure): under E02 load the machine holding the data is powered off without warning, then started again. Rules: no acknowledged link lost; redirects working again within 5 minutes. E05's counts must stay within 1% "including through the E06 power cut".
- **Failed run:** `results/e06-01/` (stage 4).
- **What the user would notice:** a creator told "saved, your link is `FXwR`" about a second before the cut found it pointing at someone else's page after the reboot; a few small links' click counts were one or more short.

## Diagnosis

1. **The last confirmed save was rolled back.** SQLite runs with its defaults (`journal_mode=DELETE`, `synchronous=FULL`). A transaction commits by deleting its rollback journal; with FULL, that deletion is not synced, and the filesystem (ext4) writes it to disk a few seconds later. A power cut in that window leaves the journal on disk, so SQLite undoes the transaction on reboot. SQLite's documentation describes exactly this and recommends `synchronous=EXTRA`.
2. **The rolled-back number was reissued.** Codes are calculated from a counting-up row number, so the next new link after reboot received the same number and the same code.
3. **The last second of counts was lost.** Counts are tallied in memory and saved once a second (stage 4); a power cut erases the unsaved tally.

## Options considered

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| **A. `PRAGMA synchronous = EXTRA`** | Problem 1 (and therefore 2): a save returns only after the journal deletion is on disk, so a confirmed link is never rolled back and its number never reissued | One extra disk sync per save; at 2–20 creates/s and one count batch per second, far below the roughly 165 durable saves/s measured | **Yes** for problem 1 |
| B. WAL journal mode | Problems 1–2: durable with FULL | New files beside the database; a bigger change than needed | No |
| C. Save counts before answering ("group commit") | Problem 3: an answered click is always saved | Every redirect waits for a save (interval of 20–25 ms to stay under the 100 ms rule); about 40–100 saves/s instead of 1, each blocking Node's single thread, risking the disk wall seen in e05-01 under the viral spike | **No: accepted failure** (below) |
| D. Accept problem 3 | — | E06's count rule stays failed | **Yes** for problem 3 |

## Accepted failure: counts through a power cut

**E06's count rule (within 1% per link) is accepted as failing (won't fix).** A sudden power cut can lose up to about one second of click counts. Links and names are not affected (problem 1 is fixed). Because "within 1%" is per link, a link with fewer than 100 clicks must be exact, so any lost click fails it; the rule turned out stricter than a real product would need for a statistic. Meeting it would mean option C: every redirect waiting for the disk and 40–100 times more saves. Decided by the user, 2026-10-04.

## Change

`system/server.ts`: `PRAGMA synchronous = EXTRA` at startup. Nothing else.

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | e01-07 | 15.1 ms | 0% | yes; counts exact | PASS |
| E02 | e02-07 | 34.2 ms (create p99 123.8 ms) | 0% | yes; counts exact | PASS |
| E03 | e03-13 | 29.9 ms (name p99 52.5 ms) | 0% | every round exactly one winner; counts exact | PASS |
| E04 | (covered by E05) | 14.2 ms | 0% | yes | PASS |
| E05 | e05-06 | 14.2 ms | 0% | counts exact (1,356,002 = 1,356,002) | PASS |
| E06 | e06-02, e06-03, e06-04 | 13.4 / 16.1 / 13.8 ms | 0% | no confirmed link lost; recovery 60–67 s | **PASS** except counts (accepted failure) |

**Did `EXTRA` slow things down?** Not steadily. Most of every regression run matches stage 4. E02 (`e02-07`) had four short disk stalls (10-second windows where CPU waiting for disk reached 4–8% and everything took 100–150 ms), which set its p99s; E03 on stage 5 (`e03-13`), which saves more, had none, and stage 4's E03 (`e03-12`) had one. Whether the extra directory sync makes stalls more likely or the shared disk had a bad few minutes is **not established** from single runs; every run passes with a wide margin.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 05 | Stage 4 with durable saves (`synchronous=EXTRA`) | E05 (about 2,100 new connections/s with counting) and E06 (power cut, recovery 60–67 s) | 14.2 ms (E05) | 0% | 1.2 GB | €8.49 + €0.50 IPv4 | not yet broken; next is E07 (machine lost). Accepted: a power cut can lose up to about 1 s of click counts |

## Interview line

"SQLite's defaults keep the file consistent but can undo the last commit after a power cut; with counting-up IDs that undo turned into two users holding the same code. One setting closed it; losing a second of click counts we accepted, because exactness would have cost a disk wait on every redirect."
