# e05-03, e05-04, e05-05: E05 Click counts, against stage 4 (attempt 2)

**Combined verdict: PASS** in 3 of 3 runs (`results/verdicts/E05-stage-04.json`). Deployed `url-shortener/stage-04` on `sfp-app` (CX33, AMD EPYC, nbg1), 10 M links. E04 traffic with counting on; counts checked 60 s after the load stopped, before the link checker (see `e05-02/NOTES.md` for why that order matters).

| Measure | e05-03 | e05-04 | e05-05 | Rule |
| --- | ---: | ---: | ---: | ---: |
| Redirect p50 / p99 (ms) | 5.6 / 15.4 | 5.4 / 14.5 | 5.3 / 14.1 | p99 < 100 |
| Viral link p99 / other links p99 (ms) | 15.4 / 15.9 | 14.5 / 15.0 | 14.0 / 14.5 | < 100 |
| Errors / wrong redirects / checker problems | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 |
| Links whose count was checked / outside 1% | 1,101 / 0 | 1,101 / 0 | 1,101 / 0 | 0 outside |
| Clicks: load generator vs server (checked links) | 1,355,755 / 1,355,755 | 1,355,667 / 1,355,667 | 1,355,740 / 1,355,740 | within 1% per link |
| Redirects letting browsers reuse them | 0 | 0 | 0 | 0 |

Every checked count was exact, not merely within 1%.

**Compared with attempt 1** (e05-01): successful redirects went from 166 per second (91% errors) to all of about 2,100 per second; CPU waiting for disk fell from about 15% to about 0.3% (e05-02, same code), because the disk is touched once a second instead of once per click.

**Regression checks on stage 4, with counting on:** E01 (`e01-06`) redirect p99 18.0 ms; E02 (`e02-06`) 12.4 ms, counts 17,262 = 17,262; E03 (`e03-12`) 28.7 ms, name-request p99 51.4 ms, every round exactly one winner and 49 "taken", counts 17,122 = 17,122. All PASS. **E04** was not run separately: E05's load is E04's load with counting added, and all three E05 runs met every E04 rule.
