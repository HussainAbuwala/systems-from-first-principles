# Stage 02: nginx in front

## Trigger

- **Event:** E03 (custom names under E02 load).
- **Failed runs:** `results/e03-02/`, `e03-03/`, `e03-04/` (stage 1); combined verdict `results/verdicts/E03-stage-01.json`.
- **What the user would notice:** while names were being claimed, about one normal click in eight took over 100 ms (redirect p99 170–180 ms against a 100 ms rule). Correctness was perfect: every round had exactly one winner.

## Diagnosis

Bursts of 50 new TLS connections arrive at the same instant, three times a second. Node performs every handshake on its single main thread, about 1.8 ms each (calib-01), so each burst occupies the thread for roughly 90 ms or more, and redirects that arrive meanwhile queue behind it.

| Resource | Value during the runs | Limit |
| --- | --- | --- |
| Node process CPU (per-second average / peak) | 52–54% / 74–77% | 100% of one vCPU |
| CPU waiting for disk | under 1% | — |
| CPU steal | 0% (e03-03, e03-04) | — |

Per-second CPU never reached the limit: the cause is sub-second bursts, visible in the latency distribution (median 8 ms, p90 116 ms) rather than in CPU averages.

## Attempts that failed

| Attempt | Why it was plausible | What failed (run ID) | Lesson |
| --- | --- | --- | --- |
| nginx with Ubuntu defaults and upstream keepalive, Node with its defaults (tag `url-shortener/stage-02-attempt-1`) | The textbook reverse-proxy setup | E03 in 3 of 3 runs (`e03-05`–`e03-07`): redirect p99 now 68–71 ms (passes), but 12–29 `POST /links` per run got 502 because nginx reused local connections Node had just closed | The proxy and the app must agree on idle timeouts: the app must keep idle connections open longer than the proxy does |

## Options considered

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| **A. nginx in front, terminating TLS** | Handshakes move to nginx's workers, one per vCPU, out of Node's queue | A second program; nginx's two workers and Node share two vCPUs during bursts; each nginx worker still queues its own share of a burst | **Yes.** No application logic changes; Node stays single-threaded, so names stay race-free |
| B. Two copies of the app (Node cluster) | Handshakes and application logic on both vCPUs | Check-then-save can now race across processes (the primary key would reject the second save as an error we must turn into 409); two SQLite writers need busy handling and probably a different journal mode | No: several simultaneous changes, harder to attribute results |
| C. Bigger or dedicated server | Faster cores | No more threads for a single-threaded design; dedicated vCPUs cost about 8 times as much | No |
| A Node proxy in front | Moves handshakes out of the app | A single Node proxy has the same one-thread queue; two proxy copies approximate nginx with more code | No: nginx is the conventional, smaller change |

**Expectation stated before running:** with two nginx workers, each burst is split roughly in half, so redirects behind a burst should wait about half as long. Halving 170–180 ms lands near the 100 ms limit, so this may or may not pass.

## Change

- `system/server.ts`: `node:http` instead of `node:https`, listening on `127.0.0.1:8080` only. No other change.
- `system/nginx-shortener.conf`: nginx listens on 443 with the same certificate and forwards to `127.0.0.1:8080` over kept-open local connections (`keepalive 32`). Everything else is Ubuntu's nginx default (`worker_processes auto`, one worker per vCPU).
- **Attempt 2:** `keepalive_timeout 4s` in the upstream block, so nginx drops an idle local connection before Node's 5-second default closes it and never sends a request down a closing connection. One line; no application change.
- `system/deploy.sh`: installs Ubuntu's nginx package and the site config.

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | e01-03 (attempt 1), e01-04 | 15.4 / 15.0 ms | 0% | yes | PASS |
| E02 | e02-04 | 11.2 ms | 0% | yes | PASS |
| E03 | e03-05, e03-06, e03-07 (attempt 1) | 71.2 / 71.1 / 68.5 ms | 0.015–0.036% | 990–996 of 1,001 rounds clean | **FAIL** (502s instead of "taken") |
| E03 | e03-08, e03-09, e03-10 (attempt 2) | 71.0 / 68.5 / 69.2 ms | 0% | every round exactly one winner and 49 "taken" | **PASS**, 3 of 3 runs |

Combined verdicts: `results/verdicts/E03-stage-02-attempt-1.json` (FAIL) and `results/verdicts/E03-stage-02.json` (PASS). Resource breakdown in `results/e03-08/NOTES.md`.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 02 | Stage 1 behind nginx (TLS on both vCPUs) | E03 (100 redirects/s + 2 creates/s + bursts of 50 name claims, 3 a second; 10 M links) | 69.2 ms (median of 3) | 0% | 1.2 GB | €5.49 + €0.50 IPv4 | not yet broken; next is E04 |

## Interview line

"When bursts of new HTTPS connections stalled a single-threaded app, we moved TLS termination into nginx, which handshakes on every core, and left the app single-threaded so its uniqueness check stayed race-free."
