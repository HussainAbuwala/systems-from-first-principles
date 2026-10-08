# Stage 08: Takedowns

Status: **done** (2026-10-08). E09 passes 3/3; every earlier event rerun; E07's latency on some hosts accepted (below).

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
| E07 | `e07-07`, `e07-08`, `e07-09` | 97.9 / **117.8** / **100.2** ms | 0% | E07's own rules pass in all three: back 236–367 s after the loss; 1–3 links lost from the old server's last moment (404, allowed), 0 to the wrong page; counter jump each time; counts short (accepted) | **FAIL** on redirect p99 in two of three runs: host network, see below; **accepted (won't fix)** |
**E07's slow redirects come from some Hetzner hosts' network, not the design.** Splitting every redirect by phase: the server's answer stayed about 3 ms p99 in all runs; the tail is in **opening the TCP connection**, and it follows the machine. Servers built by `recover.sh` in `e07-07` (A) and `e07-08` (B) had TCP connect p99 53–61 ms, about 1.5% of connects taking an extra 50–60 ms, measured both under load and with a plain connect test against the idle server (no HTTP, no app). The servers built in `e07-06` and `e07-09` had 0.7–0.84 ms. So: `e07-07` fast before the loss, slow after (A); `e07-08` slow before (A) and after (B); `e07-09` slow before (B), fast after (C). Stage 8's change cannot touch TCP connects. Every other stage 8 run (E01–E06, E08, E09) happened to run on fast machines.

## Accepted failure: slow connects on some Hetzner hosts

**E07's runs stay recorded as FAIL on redirect p99 (117.8 and 100.2 ms against 100 ms), accepted as won't fix (decided by the user, 2026-10-08):** on some Hetzner hosts about 1.5% of new TCP connections take an extra 50–60 ms to open, which puts redirect p99 at about 100–118 ms; the server's own answer time stays about 3 ms. The host is assigned by Hetzner (a rebuild after a machine loss can land on one), and the fixes would be choosing hosts (not offered on Hetzner Cloud), another location, or another provider. E07's own rules (back within an hour, at most the last 5 minutes of links lost, no code reissued) pass in all three runs. A question to Hetzner support could follow up.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 08 | Stage 7 + operator takedowns (`410 Gone`, confirmed once in the copy) | E09 (E08 load + 100 takedowns) | 14.8 ms (median of 3; creates 26.2 ms) | 0% | 12 GB | €9.56 | not broken by the script; CPU closest to its limit (about 50% average). Accepted: on some Hetzner hosts slow TCP connects put redirect p99 at about 100–118 ms (E07) |

## Interview line

"Takedowns needed no cache invalidation, because there was no cache: every click reads the database and redirects are `no-store`, so in 300 takedowns under full load not one redirect happened after a takedown."
