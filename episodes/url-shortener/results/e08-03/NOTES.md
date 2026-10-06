# e08-03: E08 10% of Bitly, against stage 7 (counter jump)

**Verdict: FAIL** on click counts only: 2 of 1,101 checked links more than 1% off, both **over**-counted (server above the load generator). Every other rule passes: **create p99 42.3 ms** (stage 6: 753–848 ms; limit 300), redirect p99 32.3 ms, 0% errors, no wrong redirects, all 7,000+ checked links correct.

**System:** stage 7 (`6e7c49c`) on `sfp-app` (CX33), 100 M links reseeded; generated links confirmed once on the server's disk, names still wait for Litestream. Load as `e08-01`: 1,000 redirects/s, 20 creates/s, 6 minutes, `STORED=100000000`, `CHECK_COUNTS=1`.

**First minute, reported separately (warm-up, not judged by rule):** redirect p99 10.0 s, create p99 10.0 s (the client timeout), 6.6% errors; 3,100 requests failed, all within the first 20 s. The freshly seeded 12 GB database is not yet in memory (cold start), as in `e08-01`/`e08-02`.

**Why the counts are over:** both links outside 1% had clicks that timed out in those first 20 s: `6LAxN` 199 recorded by the load generator, 201 counted by the server, 6 timed-out clicks; `6LzT4` 7 vs 8, 1 timed-out click. The load generator gives up after 10 s and records a failure; the server answered later and counted the click. Total: 96,089 recorded vs 96,230 counted (+141), against 3,100 failed requests. Same effect as stage 4 attempt 1 (`e05-01`), where a collapse made the server over-count. The checker now saves every link outside 1% (`outside_1pct`); `counts-recheck.json` is the re-check that found these two (server counts unchanged since the run).

**Creates:** a few 10 s windows still had create p99 near 0.1–0.9 s (at about 70–110 s), but the measured p99 over the run is 42.3 ms. Creates no longer wait for Litestream; those windows are probably disk contention on the server while Litestream reads the database for its first rewrite. Not investigated further.
