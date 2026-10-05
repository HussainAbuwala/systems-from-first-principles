# URL shortener: where we are

Handoff notes for picking the work up in a new session. Last updated 2026-10-05.

## Position

- **Current design: stage 5** (`url-shortener/stage-05`), deployed on `sfp-app`.
- **Passed:** E01–E06 (E06 with the accepted count failure below).
- **Next event: E07, machine lost.** Under E02 load the server and its disk are deleted for good; service back on a new machine within 1 hour, at most the last 5 minutes of acknowledged links lost.
- **Expected:** stage 5 fails E07 for certain (the only copy of the data is on that disk), so no load run is needed to show it; record that and design stage 6 (a copy of the data elsewhere).
- **Stage 6 options to research before deciding:** Hetzner daily backups (fails the 5-minute rule), copying the SQLite file every few minutes to separate storage, streaming every change (Litestream; needs WAL mode), a live replica. Check current Hetzner Object Storage / Storage Box prices first.
- Remaining after E07: E08 (10% of Bitly: 1,000 redirects/s, 20 creates/s, 100 M links, about 12 GB, will not fit in memory) and E09 (takedowns within 60 s; check `Cache-Control` too).

## Design so far

| Stage | Change | Forced by |
| --- | --- | --- |
| 0 | One Node 24 program (TypeScript, `node:sqlite`), HTTPS served directly, counting-up base-62 codes, 301 redirects, on a CX23 | simplest thing that works |
| 1 | `names` table; names need a hyphen or more than 7 characters; check-then-save | E03 |
| 2 | nginx terminates TLS (one worker per vCPU), Node on 127.0.0.1:8080; upstream `keepalive_timeout 4s` (attempt 1 gave 502s) | E03 bursts on Node's single thread |
| 3 | Same software on a CX33 (4 vCPU, AMD EPYC as assigned), moved to nbg1 | E04 ran out of CPU |
| 4 | Click counts tallied in memory per (link, day), saved once a second; `Cache-Control: no-store` on redirects; `GET /links/<code>/stats` (attempt 1, saving every click, collapsed at about 166 saves/s) | E05 |
| 5 | `PRAGMA synchronous = EXTRA` | E06: SQLite's default undid the last confirmed save after a power cut, and the counting-up code was reissued |

**Accepted failure (won't fix):** a sudden power cut can lose up to about one second of click counts; E06's per-link 1% rule (exact for links under 100 clicks) stays recorded as FAIL. Exact counts would need every redirect to wait for the disk.

## Machines and money

- `sfp-app`: CX33, nbg1, label `keep=true`, about €0.0136/hour. Holds 10 M seeded links.
- Load machine `sfp-load` (CPX42, nbg1) is created per session with `tools/cloud/create.sh sfp-load cpx42 load 3` and `tools/provision/provision.sh sfp-load load`, and deleted afterwards.
- Spend so far: about €2.03 of the €25 cap (`tools/cloud/spend.sh`; ledger in `results/spend-ledger.csv`). Hetzner credit is prepaid €25. Account limit: 20 shared + 8 dedicated vCPUs at once.
- The watchdog (`tools/cloud/install-watchdog.sh`) deletes test machines past their lifetime while the Mac is awake.

## How a run works

- Seed: `system/reset-and-seed.sh sfp-app 10000000 results/seed-10m/sample.csv` (or `1000 … seed-1k … 1000`).
- Run: `load/run-event.sh EVENT RUN_ID sfp-load sfp-app SAMPLE k6-args…`, with `CHECK_COUNTS=1` from E05 on, `CONTENTION_ROUNDS=1000` for E03, `POWERCUT_AFTER=150 POWERCUT_OFF=30` for E06.
- Typical arguments: E01 `-e REDIRECTS=1 -e CREATES=0.02 -e DURATION=6m`; E02 `-e REDIRECTS=100 -e CREATES=2 -e DURATION=6m`; E04/E05 add `-e DURATION=13m -e VIRAL_RATE=2000 -e VIRAL_RAMP=60 -e VIRAL_HOLD=600 -e WARMUP=60`.
- Each run writes `results/<run-id>/` (judge verdict, windows, metrics, NOTES.md). Combine repeats with `load/combine.py EVENT STAGE RUN_IDS…`.
- Keep each background job under about 25 minutes (the session stops longer ones).

## Working rules agreed along the way

- Repeats (`docs/MEASUREMENT.md`): a new event gets 3 runs unless the first is far past a limit; regression checks get 1 unless within 25% of a limit; correctness failures count after one run.
- Accepted failures (`docs/FORMAT.md`): allowed only in the open; losing a confirmed link or giving a name two owners can never be accepted.
- Every design change gets a stage log in `stages/`, a tag, a measured trigger, and regression runs of earlier events.
- Mistakes in the tooling are recorded in the run notes (e.g. `e05-02` INVALID: the link checker's own clicks were counted).
