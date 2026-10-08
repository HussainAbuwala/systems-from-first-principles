# URL shortener: where we are

Handoff notes for picking the work up in a new session. Last updated 2026-10-05.

## Position

- **All events played (E01–E09). Current design: stage 8** (`url-shortener/stage-08`), deployed on `sfp-app` (CX33, nbg1, IP 2.28.198.178; rebuilt by `recover.sh` in `e07-09`, a host with normal networking).
- **Write-up done:** stage logs `stages/01`–`08`, [scoreboard.md](scoreboard.md) with the final claim, [interview-cut.md](interview-cut.md).
- **Next (README "order of work" step 5):** write `script.md` and `storyboard.md` from what actually happened. Then decide what to do with the running system (it costs about €9.56 a month: CX33, IPv4, Volume; Better Stack is free).

**Accepted failures (won't fix):** about 1 s of click counts in a power cut or machine loss; links confirmed in the machine's last moment (E07 allows it; 404, codes never reused); on some Hetzner hosts slow TCP connects put redirect p99 at about 100–118 ms (E07 on stage 8).

**Known weak spots (not designed for):** one waiting save stops Node's only thread for everyone (dedicated writer thread deferred); custom names and takedowns wait for Litestream's copy (names assumed a small share of creates; receipt disk is the next move); no copy-lag alert if Litestream stops; Litestream's checkpoint check scans the newest LTX file (fix belongs upstream: the LTX page index); a server rebuilt at 100 M links starts cold.

## Design so far

| Stage | Change | Forced by |
| --- | --- | --- |
| 0 | One Node 24 program (TypeScript, `node:sqlite`), HTTPS served directly, counting-up base-62 codes, 301 redirects, on a CX23 | simplest thing that works |
| 1 | `names` table; names need a hyphen or more than 7 characters; check-then-save | E03 |
| 2 | nginx terminates TLS (one worker per vCPU), Node on 127.0.0.1:8080; upstream `keepalive_timeout 4s` (attempt 1 gave 502s) | E03 bursts on Node's single thread |
| 3 | Same software on a CX33 (4 vCPU, AMD EPYC as assigned), moved to nbg1 | E04 ran out of CPU |
| 4 | Click counts tallied in memory per (link, day), saved once a second; `Cache-Control: no-store` on redirects; `GET /links/<code>/stats` (attempt 1, saving every click, collapsed at about 166 saves/s) | E05 |
| 5 | `PRAGMA synchronous = EXTRA` | E06: SQLite's default undid the last confirmed save after a power cut, and the counting-up code was reissued |
| 8 | Operator takedowns: `POST /links/<code>/takedown` with a secret from `.env`, `410 Gone`, confirmed once in Litestream's copy | E09 |
| 7 | Generated links confirmed on the server's disk again, with `jump.ts` putting a placeholder a million numbers ahead after any restore (attempt 1); a heartbeat row saved every second so Litestream never checkpoints against its full copy (attempt 2; without it the write lock was held 30 s after a fresh copy) | E08 (stage 6 create p99 753–848 ms while Litestream rewrote its copy) |
| 6 | WAL mode; Litestream copies to a protected 10 GB Volume; a new link or name is confirmed only once it is in the copy (attempt 1, copying in the background, reissued a lost link's code); `GET /health` watched by Better Stack (free, email); kept, protected Primary IPs; `system/recover.sh` rebuilds on a new server, retrying CX33 for 20 min before falling back (attempt 2 stopped when Hetzner had no CX33) | E07 (machine lost) |

**Accepted failure (won't fix):** a sudden power cut or losing the machine can lose up to about one second of click counts (and, from stage 7, losing the machine loses links confirmed in its last moment, within E07's rule; their codes are never reused); the per-link 1% rule (exact for links under 100 clicks) stays recorded as FAIL in E06 and E07. Exact counts would need every redirect to wait for the disk (or the copy).

## Machines and money

- `sfp-app`: CX33, nbg1, label `keep=true`, about €0.0136/hour. Holds 10 M seeded links. Kept resources: Primary IPs `sfp-app-ipv4`/`-ipv6` (`auto_delete=false`, deletion-protected), Volume `sfp-app-copy` (deletion-protected). Better Stack monitor `5022545` (token `BETTER_STACK_TOKEN` in `.env`) emails on every outage, including test resets.
- Stage 6 runs on CX33 only (user's rule): if a recovery falls back to another type, move back with `delete.sh sfp-app` + `recover.sh` before testing.
- Load machine `sfp-load` (CPX42, nbg1) is created per session with `tools/cloud/create.sh sfp-load cpx42 load 3` and `tools/provision/provision.sh sfp-load load`, and deleted afterwards.
- Volume `sfp-app-copy` (10 GB) runs all month: about €0.57/month from 2026-10-05, not in the server ledger.
- Spend so far: about €5.39 of the €25 cap (2026-10-08 00:05 UTC) (`tools/cloud/spend.sh`; ledger in `results/spend-ledger.csv`). Hetzner credit is prepaid €25. Account limit: 20 shared + 8 dedicated vCPUs at once.
- The watchdog (`tools/cloud/install-watchdog.sh`) deletes test machines past their lifetime while the Mac is awake.

## How a run works

- Seed: `system/reset-and-seed.sh sfp-app 10000000 results/seed-10m/sample.csv` (or `1000 … seed-1k … 1000`).
- Run: `load/run-event.sh EVENT RUN_ID sfp-load sfp-app SAMPLE k6-args…`, with `CHECK_COUNTS=1` from E05 on, `CONTENTION_ROUNDS=1000` for E03, `POWERCUT_AFTER=150 POWERCUT_OFF=30` for E06, `MACHINE_LOST_AFTER=420 MONITOR_ID=5022545 RECOVER_TYPE=cx33` for E07 (with `-e DURATION=18m`).
- After a reseed, wait for Litestream's "snapshot complete" (search the journal from a time taken before the reseed) before starting a run. E08: `-e REDIRECTS=1000 -e CREATES=20 -e DURATION=6m -e STORED=100000000` with `results/seed-100m/sample.csv`; E09 adds `-e TAKEDOWNS=100 -e TAKEDOWN_SECRET_FILE=/opt/sfp/takedown-secret` (the runner copies `TAKEDOWN_SECRET` from `.env` to that file). Long chains of runs can go in one background job (timeout up to 2 h).
- Lock investigations: `load/lock-probe.mjs` (start it with `systemd-run` so SSH returns) and `load/lock-probe-report.py`; reliable when idle, not as a measure of hold length under load.
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
