# Budget: URL shortener

Planning estimates, not episode claims. The design at each level is unknown until we build it, so the system side uses a generous allowance. Actual spend comes from the Hetzner bill and replaces these numbers as runs happen.

## Prices used (Hetzner, Germany/Finland, confirmed from the Hetzner API 2026-10-03, excluding VAT)

| Item | Spec | Price |
| --- | --- | --- |
| CX23 | 2 shared vCPU, 4 GB, 40 GB disk | €0.0088/hour (€5.49/month) |
| CAX41 | 16 shared ARM vCPU, 32 GB | €0.0657/hour |
| CAX31 | 8 shared ARM vCPU, 16 GB | €0.0336/hour (€20.99/month) |
| CCX33 | 8 dedicated vCPU, 32 GB (only if shared cores prove too noisy) | €0.2219/hour |
| Volume (extra disk) | per GB | €0.0572/month, about €0.00008 per GB-hour |
| IPv4 address | per machine | €0.50/month |

Machines are billed by the hour and deleted after each session.

## Account limits (checked 2026-10-03)

Hetzner allows this account at most **20 shared vCPUs and 8 dedicated vCPUs running at once**, across all projects, and the account is too new to request more. Every level must fit inside that. Other limits (10 primary IPs, 1,024 GB of volumes, 30 snapshots) are not binding. The limit also caps how much a forgotten machine could cost.

## Per level

| Level | Load generator | System allowance | Extras | Estimate | Actual |
| --- | --- | --- | --- | ---: | ---: |
| Calibration (tools check) | CX23 × 1 h | trivial "OK" server, CX23 × 1 h | — | €0.02 |  |
| 1 Friends | CX23 × 1 h | stage 0 server (below) | — | €0.01 |  |
| 2 1% of Bitly | CX23 × 3 h | stage 0 server | filling 10 M links: minutes | €0.05 |  |
| 3 Custom names | CX23 × 2 h | stage 0 server | — | €0.02 |  |
| 4 Viral spike | CAX41 × 3 h (16 + stage 0's 2 = 18 of 20 shared vCPUs) | stage 0 server | — | €0.20 |  |
| 5 Click counts | CAX41 × 3 h | stage 0 server | — | €0.20 |  |
| 6 Power cut | CX23 × 2 h | stage 0 server | — | €0.02 |  |
| 7 Machine lost | CX23 × 2 h | spare CX23 for the rebuild | backup storage | €1.10 |  |
| 8 10% of Bitly | CAX31 × 6 h | up to 12 shared + 8 dedicated cores × 8 h | filling 100 M links | ≤ €1.45 |  |
| 9 Takedowns | CAX31 × 3 h | same as level 8 × 3 h | — | ≤ €0.60 |  |
| **Levels subtotal** |  |  |  | **≈ €3.70** |  |

## On top of the levels

| Item | Why | Estimate |
| --- | --- | ---: |
| Re-runs of earlier levels | Every design change re-checks all earlier levels | ≈ €2 |
| Mistakes and repeats | Failed setups, noisy runs, retakes for the video: double the test machines | ≈ €6 |
| Stage 0 server kept online | So real friends can use it while the video is made; one month including its IPv4 address | ≈ €6 |
| Domain name | Optional, for a nice short address; outside the cap | ≈ €10 a year |

## Total

| Case | Estimate |
| --- | ---: |
| Expected (levels + re-runs + server online one month) | ≈ €12 |
| Cautious (including mistakes and repeats) | ≈ €18 |
| Cap | **€25** |

## Biggest risk: a forgotten machine

A 16-core machine left running by accident costs €40.99 for a month (Hetzner caps hourly billing at the monthly price), more than the whole cap. Every test session creates machines with a script and deletes them with a script at the end, a watchdog deletes any test machine older than its allowed lifetime, and the Hetzner console is checked after each session. Switched-off servers are still billed, so machines are deleted, never just stopped.

## Unknowns that could move the numbers

- **How much load generator a fresh HTTPS connection per click needs.** The calibration run measures this before any level.
- **How large the system has to get at E08.** 100 million links will not fit in the stage 0 server's memory. The allowance is whatever fits in the account limits beside the load generator; the old estimate (two 16-core machines) is kept as an upper bound on cost.
- **VAT** is not included; add it if it applies to you.
