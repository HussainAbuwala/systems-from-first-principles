# Scoreboard: URL shortener

One row per stage. Every cell is measured or derived from measured numbers; run IDs are in each stage log.

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | €/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00 | One Node 24 program (`node:sqlite`), HTTPS served directly, counting-up base-62 codes, on a CX23 | E02 (100 redirects/s, 2 creates/s, 10 M links) | 17.7 ms (`e02-01`) | 0% | 1.2 GB | €5.49 + €0.50 IPv4 | E03: custom names did not exist; two creators "won" the same name |
| 01 | Stage 0 + names table, routed by format | E02 | 12.9 ms | 0% | 1.2 GB | €5.49 + €0.50 IPv4 | E03: bursts of 50 TLS handshakes on one thread (redirect p99 179.5 ms) |
| 02 | Stage 1 behind nginx (TLS on both vCPUs) | E03 (100 redirects/s + 2 creates/s + bursts of 50 name claims, 3 a second; 10 M links) | 69.2 ms (median of 3) | 0% | 1.2 GB | €5.49 + €0.50 IPv4 | E04: 2,000 clicks/s on one link ran out of CPU |
| 03 | Stage 2 on 4 vCPUs (CX33) | E04 (2,000 clicks/s on one link + E02 traffic; about 2,100 new TLS connections/s) | 14.6 ms (median of 3) | 0% | 1.2 GB | €8.49 + €0.50 IPv4 | E05: click counts did not exist (the first attempt, saving every click, collapsed at about 166 saves/s) |
| 04 | Stage 3 + click counts tallied in memory, saved once a second | E05 (about 2,100 new connections/s with counting) | 14.5 ms (median of 3) | 0% | 1.2 GB | €8.49 + €0.50 IPv4 | E06: last pre-cut link rolled back and its code reissued |
| 05 | Stage 4 with durable saves (`synchronous=EXTRA`) | E05 and E06 (power cut, recovery 60–67 s) | 14.2 ms (E05) | 0% | 1.2 GB | €8.49 + €0.50 IPv4 | E07: the only copy of the data was on the deleted disk |
| 06 | WAL mode; Litestream copies to a protected Volume; every new link waits for the copy; `/health` monitored; one-command rebuild on the kept IP | E05 and E07 (machine lost: back 3.4–5.9 min after the loss, nothing confirmed lost) | 8.3 ms (E05) | 0% | 1.2 GB | €9.56 | E08: waiting for the copy took create p99 to 753–848 ms while Litestream rewrote its copy |
| 07 | Generated links confirmed on local disk with a counter jump after any restore; names still wait for the copy; a heartbeat save every second | E08 (1,000 redirects/s, 20 creates/s, 100 M links, 12 GB, larger than memory) | 14.5 ms (median of 3; creates 22.3 ms) | 0% | 12 GB | €9.56 | E09: no way to take a link down |
| 08 | Stage 7 + operator takedowns (`410 Gone`, confirmed once in the copy) | E09 (E08 load + 100 takedowns; no redirect after any takedown) | 14.8 ms (median of 3; creates 26.2 ms) | 0% | 12 GB | €9.56 | not broken by the script; CPU closest to its limit (see below) |

€9.56 = CX33 €8.49 + IPv4 €0.50 + 10 GB Volume €0.57; Better Stack's free plan monitors `/health`. Prices excluding VAT, from Hetzner's API and pages (checked 2026-10-03 and 2026-10-05).

**Accepted failures (won't fix), stated in the video:** a power cut or the loss of the machine can lose about the last second of click counts (E06 and E07 runs stay FAIL on the per-link 1% rule); from stage 7, losing the machine loses links confirmed in its last moment (allowed by E07's 5-minute recovery point; they answer 404 and their codes are never reused).

## Final claim

**This design handles about 877 million clicks a month** (derived: 1,000 redirects/s measured at peak in E08 and E09 ÷ the peak factor of 3 × 2,629,800 s a month) **and about 17.5 million new links a month** (20 creates/s, same formula), with 100 million links stored, **redirect p99 14.8 ms** (median of three E09 runs; create p99 26.2 ms), **0% errors**, for **€9.56 a month**. **The resource closest to its limit in the largest run (E09) was CPU, at about 50% on average** (peaks 66–73%, busiest core up to 80%): nginx's TLS handshakes for 1,000 new connections a second about 1 core, Litestream up to 1.5 cores while rewriting its copy. That is what breaks next.

It survives a power cut (no confirmed link lost, back in about 60 s) and the loss of the machine (back in 3.4–5.9 minutes on the same IP, losing at most the links confirmed in the last moment), and a takedown works from the next click. No capacity above the largest run is claimed.
