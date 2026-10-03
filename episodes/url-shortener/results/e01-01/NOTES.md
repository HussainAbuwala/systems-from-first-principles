# e01-01: E01 Launch (friends step)

**Verdict: PASS.** Stage 0 unchanged.

| Measure | Result | Rule |
| --- | ---: | ---: |
| Redirects measured (after 60 s warm-up) | 300 over 299 s | 1/s |
| Redirect p50 / p99 | 9.6 / 17.8 ms | p99 < 100 ms |
| Creates measured | 6 | 0.02/s |
| Create p99 | 27.8 ms | < 300 ms |
| Errors | 0% | < 0.1% |
| Wrong redirects | 0 | 0 |
| Link checker | 1,008 links, 0 problems | 0 |

**Machines:** system `sfp-stage0` (CX23, 2 shared vCPU, 4 GB, fsn1); load `sfp-load` (CPX42, 8 shared vCPU, fsn1). Busiest server core peaked at 6%; load machine at 1%.

**Notes for honesty**

- The database held 1,001 links, not 1,000: one link (`g9`) was created by hand as a smoke test after seeding.
- The `node` CPU column reads 0 because Node 24 names its main thread `MainThread` and the recorder matched by that name. Fixed after this run (the recorder now matches the program's file name); the per-core columns above are unaffected.
- Redirects carry no caching headers (`Cache-Control` absent), as expected for stage 0. Not judged until E05 and E09.
