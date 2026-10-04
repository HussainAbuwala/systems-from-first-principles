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

## How the counts are checked

The load generator tags every click with its short code, so its own log gives the true count per link per day (successful redirects only). Sixty seconds after the load stops, `load/count-check.py` asks the server for the viral link, the 100 most-clicked links and 1,000 random others, and each must be within 1% of the truth (rounded down, so small counts must be exact). Verified locally before any Hetzner run: 890 clicks over 217 links, server 890, all exact.

**Limitation:** "at most 60 seconds behind" is checked once, 60 seconds after the load stops, not continuously during the run.
