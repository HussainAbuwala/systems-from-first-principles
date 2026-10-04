# e04-02, e04-03, e04-04: E04 Viral spike, against stage 3

**Combined verdict: PASS** in 3 of 3 runs (`results/verdicts/E04-stage-03.json`).

**System:** `url-shortener/stage-03` (stage 2 software unchanged) on `sfp-app`, a CX33 (4 shared vCPU, 8 GB) in nbg1. Load from `sfp-load` (CPX42, nbg1).

| Measure (720 s after warm-up) | e04-02 | e04-03 | e04-04 | Rule |
| --- | ---: | ---: | ---: | ---: |
| Redirect p50 / p99 | 5.3 / 14.6 ms | 5.2 / 14.6 ms | 5.2 / 13.5 ms | p99 < 100 ms |
| Viral link p99 / every other link p99 | 14.6 / 15.3 ms | 14.5 / 15.2 ms | 13.5 / 14.0 ms | < 100 ms |
| Create p99 | 29.9 ms | 29.1 ms | 26.1 ms | < 300 ms |
| Errors / wrong redirects / checker problems | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 |
| nginx error-log lines | 0 | 0 | 0 | — |

**Resources during the 10-minute hold at about 2,100 new connections per second**

| | e04-02 | e04-03 | e04-04 |
| --- | ---: | ---: | ---: |
| Average across the 4 vCPUs | 70% | 69% | 69% |
| nginx (4 workers together; 400% = all vCPUs) | 235% | 232% | 231% |
| Node | 34% | 34% | 34% |
| Steal (peak) | 0% | 0% | 0% |
| Accept queue on 443 (peak connections waiting) | 25 | 3 | 3 |
| Connections turned away | 0 | 0 | 0 |

**Confounder: the hardware changed as well as the core count.** The CX33 reports an **AMD EPYC (Rome)** processor; the CX23 (`sfp-stage0`) reports an **Intel Xeon (Skylake)**. Hetzner's CX line uses either. Derived CPU cost per new connection: about 2.0 ms on the CX23 (E03 and E04 on stage 2) and about 1.3 ms here (69% of 4 vCPUs ≈ 2,770 ms of CPU per second for about 2,100 connections). So stage 3 changed core count, CPU model and location (fsn1 to nbg1) at once; the share of the gain due to each is not separated. Consequence for claims: a CX33 that lands on Intel hardware may have less headroom than this one.

**Regression checks on stage 3 (one run each):** E01 (`e01-05`) redirect p99 11.8 ms; E02 (`e02-05`) 12.3 ms, create p99 22.2 ms; E03 (`e03-11`) 27.6 ms, name-request p99 52.4 ms, every round exactly one winner and 49 "taken". All PASS with no errors.
