# calib-01: tools check

**Date:** 2026-10-03. **Purpose:** check the measuring tools against a server that does nothing, before any level. Not an event; nothing is designed from it.

**Setup:** crowd on `sfp-load` (CPX62, 16 shared AMD vCPU) because CAX41 was sold out; target `sfp-ok` (CX23, 2 shared vCPU, Node 24.21 `tools/okserver/ok.mjs`). Both in fsn1. Every request a new TLS connection (ECDSA P-256 certificate), no redirects followed. Steps of 100, 250, 500, 1,000, 2,000, 4,000 and 8,000 requests/s, 60 s each after a 10 s ramp.

| Target req/s | Handled | p50 | p99 | Errors | Busiest core | Crowd CPU |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 100 | 9 ms | 16 ms | 0% | 42% | 3% |
| 250 | 250 | 8 ms | 33 ms | 0% | 74% | 5% |
| 500 | 500 | 8 ms | 52 ms | 0% | 96% | 9% |
| 1,000 | 968 | 1,470 ms | 12,927 ms | 31% | 100% | 16% |
| 2,000 | 1,993 | 1,516 ms | 8,835 ms | 64% | 100% | 27% |
| 4,000 | 3,080 | 1,363 ms | 7,924 ms | 75% | 100% | 35% |
| 8,000 | 3,486 | 1,072 ms | 7,698 ms | 76% | 100% | 37% |

(Per-step maxima over the hold windows, from `windows.csv`.)

**Findings**

1. **The tools are trustworthy.** Latency is low and steady at low rates, and the crowd never exceeded 37% CPU, so later slowdowns belong to the system under test.
2. **A CX23 running Node's HTTPS alone keeps up to about 500–575 new connections/s,** then collapses: by ~750/s the median visit takes over a second and errors follow. This is before any shortener logic.
3. **One core saturates while the other stays mostly idle.** Node runs its JavaScript, including each TLS handshake, on one main thread. Average CPU (50–65%) hides this; the busiest core reads 100%.
4. **The crowd can be smaller.** At 2,000 requests/s the 16-core crowd used 27% CPU, so an 8-core CPX42 is expected to suffice for every level (checked per run by the 70% rule).

**Not established:** how much of the ~1.8 ms of main-thread time per request (1,000 ms ÷ ~550) is the TLS handshake versus the rest of the request. A run with connection reuse would separate them; not run.

**Tool changes prompted by this run:** windows where k6 skips requests while the crowd has spare CPU are labelled SATURATED rather than INVALID; k6 failure logging turned off (75 MB of warnings); the recorder now records each named program's own CPU so a single thread's load is visible directly.

Raw per-request output (`k6.csv.gz`, 32 MB) and k6's console output are kept locally, not in git.
