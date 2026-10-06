# URL shortener: where we are

Handoff notes for picking the work up in a new session. Last updated 2026-10-05.

## Position

- **Current design: stage 6** (`url-shortener/stage-06`), deployed on `sfp-app` (CX33, rebuilt by `recover.sh` several times; same IP 2.28.198.178).
- **Passed:** E01–E07 (E06 and E07 with the accepted count failure below). Stage log: `stages/06-copy-off-the-machine.md`.
- **Next event: E08, 10% of Bitly:** 1,000 redirects/s, 20 creates/s, 100 M links stored (about 12 GB, will not fit in memory). Not started; nothing designed for it.
- After that: E09 (takedowns within 60 s; check `Cache-Control` too).

**E08 expectation, stated before the first run (2026-10-05 22:10 UTC):** stage 6 probably passes, with creates closest to their limit. Reasoning: TLS handshakes at 1,000 new connections/s are about half of what this CX33 handled in E04/E05 (about 2,100/s at roughly 70% CPU). The 12 GB database does not fit in about 7 GB of page cache, but on the Zipf curve about three quarters of clicks go to the top 1 million links (at most about 1 million pages, about 4 GB), so most lookups stay in memory; the roughly 12% of clicks beyond the top 10 million read the disk, each blocking Node's single thread briefly. Creates are the unknown: 20/s, each waiting for a local disk sync and for Litestream's copy to the Volume (one sync at a time), against 2/s so far; create p99 could rise from about 60 ms towards a few hundred ms. Setup: `STORED=100000000` (Zipf over every stored link), 10 GB Volume unchanged.

**E08 run 1 (`e08-01`, 22:07 UTC): FAIL on create p99 753 ms** (limit 300); redirects 17.8 ms, 0% errors, links and counts correct. Cause: every create waits for its own copy through Litestream, one at a time (3,082 small files in 5 min; spikes when Litestream reorganises its copies). Diagnostic repeat `e08-02` (Litestream CPU recorded): the 1-second creates come from Litestream rewriting its whole 1.7 GB copy (after every fresh copy, hourly once, daily); steady create p99 150–180 ms. Options in `stages/07-tbd.md`.

**Where we stopped (2026-10-06 02:45 UTC): waiting on the user to choose between two fixes.**
1. **Counter jump + names keep waiting** (my recommendation; smallest change): generated links confirm once on the server's disk (no wait for Litestream); after any real restore, `deploy.sh` inserts a placeholder link (empty URL, answers 404) at the restored maximum id + 1,000,000, so a lost code is never reissued (5 min at E08's 20 creates/s = 6,000 links); custom names keep waiting for Litestream's copy (no counter trick exists for names). Relies on an **assumption not in the traffic model**: custom names are a small share of creates (E08's load has none; E03 has about 3 saved names/s). What breaks next: busy name creation, during Litestream's big rewrites.
2. **Receipt disk** (complete, a couple of hours): the app writes a tiny receipt for each new link and name to a second small Volume (about €0.57/month) and confirms after flushing it; Litestream copies in the background without anyone waiting; `recover.sh` restores from Litestream, replays missing receipts (`INSERT OR IGNORE`, same id/name; stop if a row exists with a different URL), then starts the app. Independent of the name share.
Rejected or set aside: sharing copies between creates (does not stop the spikes), tidying up less via Litestream's `levels` (slower restores, small benefit once links stop waiting), random codes (random row ids work without an extra index but scatter new links through the table; no help for names), Object Storage (uncertain).
**Also to do with any fix:** report the first (warm-up) minute of every E08 run separately (cold start: 30 s of errors after a fresh 100 M database; Litestream's first rewrite), without changing the judged rule.

`sfp-app` holds 100 M links (reseed before the next run). No load machine running (the watchdog deleted it at 02:14 UTC after sitting idle about 3.5 h, about €0.45 wasted: delete it when a discussion starts). Recorder now tracks Litestream's CPU.

**Things E08 will touch (known, not designed for):** the Volume is 10 GB (Litestream's copy of 100 M real-looking links will be bigger; test data compresses unusually well); every create now waits for the copy (create p99 about 60 ms at 2 creates/s, unmeasured at 20/s); the fallback branch of `recover.sh` has not yet run for real.

## Design so far

| Stage | Change | Forced by |
| --- | --- | --- |
| 0 | One Node 24 program (TypeScript, `node:sqlite`), HTTPS served directly, counting-up base-62 codes, 301 redirects, on a CX23 | simplest thing that works |
| 1 | `names` table; names need a hyphen or more than 7 characters; check-then-save | E03 |
| 2 | nginx terminates TLS (one worker per vCPU), Node on 127.0.0.1:8080; upstream `keepalive_timeout 4s` (attempt 1 gave 502s) | E03 bursts on Node's single thread |
| 3 | Same software on a CX33 (4 vCPU, AMD EPYC as assigned), moved to nbg1 | E04 ran out of CPU |
| 4 | Click counts tallied in memory per (link, day), saved once a second; `Cache-Control: no-store` on redirects; `GET /links/<code>/stats` (attempt 1, saving every click, collapsed at about 166 saves/s) | E05 |
| 5 | `PRAGMA synchronous = EXTRA` | E06: SQLite's default undid the last confirmed save after a power cut, and the counting-up code was reissued |
| 6 | WAL mode; Litestream copies to a protected 10 GB Volume; a new link or name is confirmed only once it is in the copy (attempt 1, copying in the background, reissued a lost link's code); `GET /health` watched by Better Stack (free, email); kept, protected Primary IPs; `system/recover.sh` rebuilds on a new server, retrying CX33 for 20 min before falling back (attempt 2 stopped when Hetzner had no CX33) | E07 (machine lost) |

**Accepted failure (won't fix):** a sudden power cut or losing the machine can lose up to about one second of click counts; the per-link 1% rule (exact for links under 100 clicks) stays recorded as FAIL in E06 and E07. Exact counts would need every redirect to wait for the disk (or the copy).

## Machines and money

- `sfp-app`: CX33, nbg1, label `keep=true`, about €0.0136/hour. Holds 10 M seeded links. Kept resources: Primary IPs `sfp-app-ipv4`/`-ipv6` (`auto_delete=false`, deletion-protected), Volume `sfp-app-copy` (deletion-protected). Better Stack monitor `5022545` (token `BETTER_STACK_TOKEN` in `.env`) emails on every outage, including test resets.
- Stage 6 runs on CX33 only (user's rule): if a recovery falls back to another type, move back with `delete.sh sfp-app` + `recover.sh` before testing.
- Load machine `sfp-load` (CPX42, nbg1) is created per session with `tools/cloud/create.sh sfp-load cpx42 load 3` and `tools/provision/provision.sh sfp-load load`, and deleted afterwards.
- Volume `sfp-app-copy` (10 GB) runs all month: about €0.57/month from 2026-10-05, not in the server ledger.
- Spend so far: about €3.63 of the €25 cap (2026-10-06 02:40 UTC) (`tools/cloud/spend.sh`; ledger in `results/spend-ledger.csv`). Hetzner credit is prepaid €25. Account limit: 20 shared + 8 dedicated vCPUs at once.
- The watchdog (`tools/cloud/install-watchdog.sh`) deletes test machines past their lifetime while the Mac is awake.

## How a run works

- Seed: `system/reset-and-seed.sh sfp-app 10000000 results/seed-10m/sample.csv` (or `1000 … seed-1k … 1000`).
- Run: `load/run-event.sh EVENT RUN_ID sfp-load sfp-app SAMPLE k6-args…`, with `CHECK_COUNTS=1` from E05 on, `CONTENTION_ROUNDS=1000` for E03, `POWERCUT_AFTER=150 POWERCUT_OFF=30` for E06, `MACHINE_LOST_AFTER=420 MONITOR_ID=5022545 RECOVER_TYPE=cx33` for E07 (with `-e DURATION=18m`).
- After a reseed, wait for Litestream's "snapshot complete" before starting a run.
- Typical arguments: E01 `-e REDIRECTS=1 -e CREATES=0.02 -e DURATION=6m`; E02 `-e REDIRECTS=100 -e CREATES=2 -e DURATION=6m`; E04/E05 add `-e DURATION=13m -e VIRAL_RATE=2000 -e VIRAL_RAMP=60 -e VIRAL_HOLD=600 -e WARMUP=60`.
- Each run writes `results/<run-id>/` (judge verdict, windows, metrics, NOTES.md). Combine repeats with `load/combine.py EVENT STAGE RUN_IDS…`.
- Keep each background job under about 25 minutes (the session stops longer ones).

## Working rules agreed along the way

- Repeats (`docs/MEASUREMENT.md`): a new event gets 3 runs unless the first is far past a limit; regression checks get 1 unless within 25% of a limit; correctness failures count after one run.
- Accepted failures (`docs/FORMAT.md`): allowed only in the open; losing a confirmed link or giving a name two owners can never be accepted.
- Every design change gets a stage log in `stages/`, a tag, a measured trigger, and regression runs of earlier events.
- Mistakes in the tooling are recorded in the run notes (e.g. `e05-02` INVALID: the link checker's own clicks were counted; `e07-01`/`e07-04` judge corrections).
- Machine type is part of the design: no tests on a different type unless a failure forces the change.
- E07 on stage 6 used one new run plus two from attempt 2 (user's decision to save time; the change only affected an unused path).
