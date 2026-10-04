# Stage 03: A bigger server

## Trigger

- **Event:** E04 (Load): one link ramps to 2,000 clicks/s and holds for 10 minutes on top of E02 traffic. Every click is a new TLS connection.
- **Failed run:** `results/e04-01/` (stage 2 on a CX23). One run: redirect p99 9,356 ms, about 94 times the limit.
- **What the user would notice:** during the spike, every link (not only the viral one) took seconds to open, and about one visit in five timed out.

## Diagnosis

Both vCPUs ran at 100%, mostly nginx doing TLS handshakes (about 170% of a vCPU), with Node at about 30%. Steal 0%, disk waits under 1%. The server kept up to roughly 1,000–1,350 new connections per second and collapsed beyond that; E04 needs about 2,100.

Splitting each visit into phases (k6 timings) showed where visitors waited: answering from Node stayed at a few milliseconds, while the TLS handshake (median 295 ms) and, for the unlucky, getting the connection accepted at all (p99 5.1 s, from the kernel's accept queue filling and clients retrying) took the time. The queue was at the front door, not in the application.

| Resource | Value during the spike | Limit |
| --- | --- | --- |
| vCPU 0 and 1 | 100% | 100% |
| nginx CPU | about 170% | 200% (both vCPUs) |
| Node CPU | about 30% | 100% |
| Steal / disk wait | 0% / under 1% | — |

## Options considered

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| **A. Bigger server: CX33 (4 shared Intel vCPU)** | Twice the vCPUs for nginx's handshakes; nothing else changes | €8.49/month instead of €5.49. Not offered in fsn1, so the system and load machine move to nbg1. Doubling capacity lands near what E04 needs, so it may not pass | **Yes.** Smallest change: same software, same design, more cores |
| B. Hetzner load balancer (LB11) terminating TLS in front of the CX23 | Moves every handshake off our server | €7.49/month on top of €5.49; Hetzner publishes no handshake rate, so its capacity is unknown | Next if A fails |
| C. Several servers behind a load balancer | Scales further | SQLite is one file on one machine: a redesign | Not yet |
| D. CDN in front | Handshakes near visitors; could cache the redirect | Needs a domain; caching conflicts with E05 counts and E09 takedowns; load-testing someone else's network | Not now |
| A cache for hot links | Nothing here | — | Lookups already come from memory in about a millisecond; the cost is the handshake per new visitor |

**Expectation stated before running:** about twice stage 2's measured ceiling, so roughly 2,000–2,700 new connections per second. E04 needs about 2,100: may or may not pass.

## Change

Machine only: `url-shortener/stage-02` software unchanged on a CX33 (`sfp-app`, nbg1) instead of a CX23 (`sfp-stage0`, fsn1). nginx's `worker_processes auto` gives four workers. Load machine moves to nbg1 with it (same type, CPX42).

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | e01-05 | 11.8 ms | 0% | yes | PASS |
| E02 | e02-05 | 12.3 ms | 0% | yes | PASS |
| E03 | e03-11 | 27.6 ms | 0% | every round exactly one winner and 49 "taken" | PASS |
| E04 | e04-02, e04-03, e04-04 | 14.6 / 14.6 / 13.5 ms | 0% | yes | **PASS**, 3 of 3 runs |

**Confounder:** the CX33 reports an AMD EPYC (Rome) processor where the CX23 reported an Intel Xeon (Skylake); the location also changed. CPU per new connection fell from about 2.0 ms to about 1.3 ms, so the gain is more than doubling the cores alone would give, and the split between cores, CPU model and location is not separated. Details in `results/e04-02/NOTES.md`.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 03 | Stage 2 on 4 vCPUs (CX33, AMD EPYC as assigned) | E04 (2,000 clicks/s on one link + E02 traffic; about 2,100 new TLS connections/s) | 14.6 ms (median of 3) | 0% | 1.2 GB | €8.49 + €0.50 IPv4 | not yet broken; about 70% CPU at E04's peak; next is E05 |

## Interview line

"When TLS handshakes for a viral link saturated two vCPUs, the first move was the cheapest one: scale up to four, before adding a load balancer."
