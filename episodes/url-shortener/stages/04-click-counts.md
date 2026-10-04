# Stage 04: Click counts

## Trigger

- **Event:** E05 (Requirement): creators see total clicks per link per day, at most 60 seconds behind, within 1% of the true number, including through the E06 power cut. Tested by rerunning E04 (viral spike) with counting on. Browser caching is checked too: redirects must not let browsers reuse them, or repeat clicks never reach the server.
- **Stage 3's behaviour:** it has no counting at all: `GET /links/<code>/stats` answers 404 (it is treated as an unknown short code), and redirects carry no caching instructions, so browsers may reuse a 301 indefinitely. The outcome of E05 against stage 3 is determined without a load run, so none was made.

## Attempts

### Attempt 1: save every click immediately

The obvious design, shown on purpose: a `clicks (code, day, count)` table, and every redirect runs `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1` synchronously with SQLite's default (fully durable) settings before answering. `GET /links/<code>/stats` returns counts per UTC day. Redirects now carry `Cache-Control: no-store`.

**Expectation stated before running:** collapse. Stage 0 (e03-01) collapsed at about 165 synchronous saves per second, with Node's single thread waiting for the disk; E05 asks for about 2,100.

**Result (`results/e05-01/`): FAIL, collapse.** 166 successful clicks per second against about 2,100 offered; 91% errors; Node's thread waiting on the disk (iowait 15%, CPU mostly idle). The same ceiling as stage 0's synchronous saves (about 165/s, e03-01). The stall cascaded into nginx (worker connections exhausted, 500s, connections turned away), and the server over-counted by about 5.6% because it finished requests whose visitors had already given up.

### Attempt 2: count in memory, save once a second

Each redirect adds one to an in-memory tally keyed by (link, day of the click) and answers immediately. Once a second, all tallies are written to the `clicks` table in a single transaction (one disk wait per second instead of one per click), then cleared; a failed save keeps the tallies for the next second. On a normal stop or restart the pending tallies are saved before exiting. Links and names are still saved immediately, unchanged.

**What it gives up:** a sudden power cut can lose up to about one second of counts. E05 itself has no crash; E06 will test this. Because "within 1%" is per link, a link with fewer than 100 clicks must be exact, so losing even one click from such a link would fail E06's count check. That is expected to be tested, not pre-empted.

**Verified locally before deploying:** 890 clicks over 211 links, server 890, all exact two seconds after the load stopped; five clicks followed immediately by a stop and restart were all kept.

**Result: PASS, 3 of 3 runs** (`results/e05-03/`, `e05-04/`, `e05-05/`): redirect p99 14.1–15.4 ms, no errors, every one of 1,101 checked links' counts exact in every run. A first run (`e05-02`) is INVALID: the link checker's own clicks were counted (see its notes).

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | e01-06 | 18.0 ms | 0% | yes | PASS |
| E02 | e02-06 | 12.4 ms | 0% | yes; counts exact | PASS |
| E03 | e03-12 | 28.7 ms | 0% | every round exactly one winner; counts exact | PASS |
| E04 | (covered by E05 runs) | 14.1–15.4 ms | 0% | yes | PASS |
| E05 | e05-03, e05-04, e05-05 | 15.4 / 14.5 / 14.1 ms | 0% | counts exact | **PASS**, 3 of 3 |

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 04 | Stage 3 + click counts tallied in memory, saved once a second | E05 (about 2,100 new connections/s with counting) | 14.5 ms (median of 3) | 0% | 1.2 GB | €8.49 + €0.50 IPv4 | not yet broken; next is E06 (power cut) |

## Interview line

"Saving every click durably capped us at about 165 per second on this disk, so counts are tallied in memory and written once a second in one transaction: exact under load, and a crash can cost at most about a second of counts."

## How the counts are checked

The load generator tags every click with its short code, so its own log gives the true count per link per day (successful redirects only). Sixty seconds after the load stops, `load/count-check.py` asks the server for the viral link, the 100 most-clicked links and 1,000 random others, and each must be within 1% of the truth (rounded down, so small counts must be exact). Verified locally before any Hetzner run: 890 clicks over 217 links, server 890, all exact.

**Limitation:** "at most 60 seconds behind" is checked once, 60 seconds after the load stops, not continuously during the run.
