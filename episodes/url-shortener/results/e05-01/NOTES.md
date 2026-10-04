# e05-01: E05 Click counts, against stage 4 attempt 1 (save every click immediately)

**Verdict: FAIL** (one run: far past every limit). Collapse, as predicted.

**System:** `url-shortener/stage-04-attempt-1` on `sfp-app` (CX33, AMD EPYC, nbg1), 10,000,000 links. E04 traffic: E02 load plus one link ramping to 2,000 clicks/s, held 10 minutes.

| Measure | Result | Rule |
| --- | ---: | ---: |
| Redirect p99 | 10,003 ms (the 10 s client timeout) | < 100 ms |
| Errors | 91.2% | < 0.1% |
| Successful redirects per second during the hold | **166** (of about 2,100 offered) | — |
| Responses: timed out / 301 / 500 / 502 | 1,265,938 / 127,922 / 2,761 / 248 | — |
| Redirects telling browsers not to reuse them | 1,382 of 1,382 checked (`no-store`) | all |
| Click counts within 1%, 60 s after the load stopped | 870 of 1,101 links | all |
| Link checker (correct destinations) | 1,382 links, 0 problems | 0 |

**Why: the disk wall again, now at the front of every click.** Every redirect ran a synchronous, fully durable SQLite update before answering, so Node's single thread waited for the disk on every click.

| During the 9-minute hold | Value |
| --- | ---: |
| CPU waiting for disk (average / peak) | 14.9% / 23.8% |
| Disk writes | about 19 MB/s |
| Node CPU | 17% |
| Average across the 4 vCPUs | about 30% |

The CPU was mostly idle; the thread was waiting. **166 successful clicks per second matches stage 0's collapse at about 165 synchronous saves per second (e03-01)**: the same ceiling, measured twice, on different hardware (Intel CX23 in fsn1, AMD CX33 in nbg1).

**The failure cascades outward.** With Node stuck, requests pile up inside nginx until each worker's connection limit (Ubuntu's default `worker_connections 768`) is full: nginx logged about 1.14 million "worker_connections are not enough", answered some visitors with 500, and stopped accepting new connections, so the kernel turned away about 12,000 connection attempts every 10 seconds.

**Counts went over, not under.** The server counted 125,550 clicks against 118,913 the load generator saw succeed (viral link: 117,257 against 111,077, +5.6%). Visitors gave up after 10 seconds, but nginx and Node still processed many of those queued requests later, and counted them. Under overload, "a click" stops being well defined: the server counted redirects nobody received.

**Tool note:** the load script's `wrong_redirects` (3,238) counted every non-301 answer, including the 500s and 502s, not only redirects to a wrong address. The link checker found no wrong destinations. Fixed after this run so the measure counts only 301s pointing at the wrong URL; errors are already counted separately.
