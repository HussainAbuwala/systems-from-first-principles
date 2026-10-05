# e08-01: E08 10% of Bitly, against stage 6

**Verdict: FAIL** on create p99: 753.1 ms against 300 ms (2.5 times the limit, so one run is enough: more runs cannot change the verdict). Everything else passes: redirect p99 17.8 ms (limit 100), 0% errors, no wrong redirects, every one of 7,664 checked links correct, click counts within 1% on all 1,101 checked links (97,523 sent vs 97,524 on the server).

**System:** stage 6 (`url-shortener/stage-06`) on `sfp-app` (CX33: 4 vCPU, 8 GB, nbg1), **100 M links** reseeded (12 GB database; Litestream's first full copy 1.7 GB, done 125 s after the seed). Load from `sfp-load` (CPX42): 1,000 redirects/s, 20 creates/s, 6 minutes, `STORED=100000000`: clicks follow the Zipf curve over every stored link (about 64% to the top 100,000, 12% beyond the top 10 million), popular links scattered through the table. `CHECK_COUNTS=1`.

**Expectation stated before the run** (STATUS.md, 22:10 UTC): probably passes, with creates closest to their limit. Creates were indeed the weak point, but they failed.

**What ran out: the single path through Litestream that every create waits on.**
- Every create asks Litestream to copy to the Volume and waits (stage 6 attempt 2). At 20 creates/s that is 20 separate copies a second, one at a time. In 5 minutes Litestream wrote **3,082 small change files** to the Volume (and as many locally).
- Create p99 per 30 s window rose through the run (53 → 94 → 222 → 134 → 962 → 145 → 155 → 175 → 188 → 179 ms) as the small files piled up. The worst windows (962–1,519 ms at 190–260 s) line up with Litestream reorganising its 1.6–1.7 GB copies: disk reads up to 17 MB/s and writes up to 36 MB/s in those windows, against about 1 MB/s and 5–10 MB/s otherwise.
- Not the limit: Node's thread (about 22% of a core), nginx (about one core of four, TLS for 1,000 new connections/s), overall CPU 45–65%, disk wait (iowait) 6–7%, steal 0%. Litestream's own CPU was not recorded in this run (its lifetime average since the reseed was about one core, mixing the 12 GB snapshot and the run); the recorder now tracks it.

**Cold start (warm-up, not judged):** in the first 30 s the freshly seeded 12 GB database was not in memory: p99 10 s, 3.3% errors, 2,502 connections turned away, the load generator unable to send 3,793 requests. The judge measures after a 60 s warm-up, as for every event. Worth stating: a rebuilt server after a machine loss at this size would start just as cold.

**Volume:** 55% full after the run (5.0 of 9.8 GB: the full copy in three layers plus small files).
