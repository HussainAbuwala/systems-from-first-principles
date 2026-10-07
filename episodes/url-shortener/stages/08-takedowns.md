# Stage 08: Takedowns

Status: **built, E09 passes 3/3, E08 rerun passes; reruns of E01–E07 in progress** (2026-10-07).

## Trigger

- **Event:** E09 (Requirement): under E08 load (1,000 redirects/s, 20 creates/s, 100 M links), 100 links are reported and taken down during the run. Rule: no taken-down link redirects more than 60 s after its takedown; no redirect may let a browser reuse it for more than 60 s.
- **Failed run:** `results/e09-01/` (stage 7): 0 of 101 takedowns confirmed; there was no way to take a link down. Everything else passed (redirect p99 16.4 ms, counts exact).
- **What the user would notice:** a reported scam link keeps working; nothing an operator can do short of editing the database by hand.

## Diagnosis

A missing feature, not an exhausted resource. The 60-second rule is aimed at caches (a CDN, browser caching, an in-memory link cache) that keep serving an old answer. Stage 7 has none: every click looks the link up in the database, and redirects already carry `Cache-Control: no-store` (since stage 4).

## Options considered (decided with the user, 2026-10-07)

| Question | Chosen | Alternative | Why |
| --- | --- | --- | --- |
| Who may take a link down? | an operator secret (bearer token in a header, from `.env`, kept out of git and out of recorded run arguments) | open to anyone | open would let anyone kill any link; accounts are not required by any event |
| What does a removed link answer? | `410 Gone`, "This link was removed", `no-store`, click not counted | `404` | honest that it existed and was removed on purpose; keeps it distinct from mistyped codes and the counter-jump placeholder |
| Confirm before or after the copy? | after Litestream's copy (like custom names); if the copy fails the link stays down and the operator is asked to repeat (`503`) | confirm at once | a takedown lost in a machine loss would bring the link back after recovery; takedowns are rare, so the wait costs nothing visible; clicks do not wait for it |
| How do reports arrive? | an operator process (no public report form) | a public "report this link" form | the rule concerns what happens after the takedown; a form needs spam protection and review, which no event asks for |

## Change

- `system/server.ts`: a `taken_down_at` column on `links` and `names`, added once at startup (instant in SQLite, even at 100 M rows); `POST /links/<code>/takedown` checks the operator secret (constant-time), marks the link or name, waits for Litestream's copy, answers `200`; redirects of a taken-down link answer `410` without counting; a taken-down name stays registered (cannot be claimed again) and a taken-down code is never reissued.
- `system/deploy.sh`: sends the settings, including `TAKEDOWN_SECRET`, over SSH input into a root-only `/etc/shortener.env`.
- `system/litestream.yml`: comment updated (only custom names and takedowns wait for the copy).

**Hand check on `sfp-app` (2026-10-07):** no or wrong secret `401`; unknown code `404`; takedown `200` in 28 ms; afterwards `410` with `no-store`; repeating `200`; a taken-down name answers `410` and re-registering it gets `409`; other links unaffected.

## E09 on stage 8

| Run | Takedowns confirmed | Redirects after a takedown | 410 for live links | Redirect p99 | Create p99 | Errors | Counts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `e09-02` | 100 / 100 | 0 | 0 | 13.7 ms | 20.6 ms | 0% | exact |
| `e09-03` | 100 / 100 | 0 | 0 | 15.9 ms | 28.1 ms | 0% | exact |
| `e09-04` | 100 / 100 | 0 | 0 | 14.8 ms | 26.2 ms | 0% | exact |

60 of each run's takedowns were the most popular links (Zipf ranks 1–60), so clicks kept arriving: every one after its takedown was answered `410`. No redirect lets browsers reuse it. **Judge correction:** the first judgement of all three said "0 of 100 confirmed" because k6 stores a tag named `status` in its own column; fixed, earlier events re-judge unchanged (see each run's NOTES.md).

**Resources (largest run):** CPU 48–51% average (peaks 66–73%, busiest core up to 80%, steal 0%); nginx about 1–1.1 cores, Litestream about 0.6 (up to 1.5), Node about 0.25; load generator under 45%.

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E08 | `e08-10` | 12.7 ms (create 18.5 ms) | 0% | counts exact | PASS |
| E01 | `e01-10` | 10.8 ms (create 9.4 ms) | 0% | yes; counts exact | PASS |
| E02 | `e02-10` | 7.8 ms (create 10.9 ms) | 0% | yes; counts exact | PASS |
| E03 | `e03-16` | 29.5 ms (create 29.6 ms) | 0% | exactly one winner in all 1,001 rounds; counts exact | PASS |
| E04 | (covered by E05) | 6.4 ms | 0% | yes | PASS |
| E05 | `e05-09` | 6.4 ms (create 10.9 ms) | 0% | counts exact (1,355,475 = 1,355,475) | PASS |
| E06 | `e06-07` | 7.8 ms | 0% | no confirmed link lost; back 55 s after the power cut; 8 of 1,101 links' counts short | **PASS** except counts (accepted) |
| E07 | `e07-07` (+ `e07-08`, `e07-09` in progress) | **97.9 ms** | 0% | back 298 s after the loss; 1 link lost (confirmed in the old server's last moment, 404, allowed), 0 to the wrong page; counter jumped 10,000,818 → 11,000,819; 8 links' counts short | **PASS** except counts (accepted); redirect p99 within 25% of its limit, so two more runs |

**`e07-07`'s redirect p99 (97.9 ms, against 7.5–10.4 ms in every earlier E07 run):** before the loss redirects were as usual; on the rebuilt server, every 10 s window had redirect p99 110–120 ms while its CPU was about 6%. Split by phase (load generator, after recovery): server answer p99 3.6 ms and TLS handshake p99 4.2 ms, as before, but **TCP connect p99 53 ms** (stage 7's rebuilt server in `e07-06`: 0.7 ms). The delay is in opening the connection, before nginx or the app sees the request, which stage 8's change does not touch. On the rebuilt server, idle: `fsync` 1.4 ms median, `/health` p99 1.7 ms with no stalls. Measured next: plain TCP connects to that server, and two more E07 runs, each on a freshly built server.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 08 | Stage 7 + operator takedowns (`410 Gone`, confirmed once in the copy) | E09 (E08 load + 100 takedowns) | 14.8 ms (median of 3; creates 26.2 ms) | 0% | 12 GB | €9.56 | not broken by the script; CPU closest to its limit (about 50% average) |

## Interview line

"Takedowns needed no cache invalidation, because there was no cache: every click reads the database and redirects are `no-store`, so in 300 takedowns under full load not one redirect happened after a takedown."
