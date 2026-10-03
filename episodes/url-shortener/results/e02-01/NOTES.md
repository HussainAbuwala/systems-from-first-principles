# e02-01: E02 1% of Bitly

**Verdict: PASS.** Stage 0 unchanged.

| Measure | Result | Rule |
| --- | ---: | ---: |
| Redirects measured (after 60 s warm-up) | 30,053 over 300 s | 100/s |
| Redirect p50 / p99 | 7.5 / 17.7 ms | p99 < 100 ms |
| Creates measured | 602 | 2/s |
| Create p99 | 26.0 ms | < 300 ms |
| Errors | 0% | < 0.1% |
| Wrong redirects | 0 | 0 |
| Link checker | 1,721 links (721 created in the run, 1,000 seeded), 0 problems | 0 |

**Starting state:** 10,000,000 links seeded in 26.9 s; database 1.2 GB on the CX23's local disk. Clicks drawn with Zipf s = 1 over a uniform sample of 100,000 stored links.

**Resources during the measured period (sfp-stage0, CX23):**

| | Average | Peak |
| --- | ---: | ---: |
| Node process CPU (100 = one core) | 40% | 52% |
| Busiest core | 37% | 41% |
| Memory used | 542 MB | 559 MB |
| Disk reads | 0 KB/s | 0 KB/s |
| Disk writes | 182 KB/s | 1,016 KB/s |

Load machine (CPX42) peaked at 4% CPU.

**Notes**

- **No disk reads at all:** the 1.2 GB database had just been written, so the operating system still held all of it in memory (page cache). Every lookup came from memory. This will not hold at E08, where 100 million links (about 12 GB) exceed the server's 4 GB.
- The Node process at 40% of one core for 100 clicks/s is in line with calib-01 (about 35% of a core for 100 bare HTTPS requests/s): at this level the shortener's own work adds little to the cost of the TLS handshakes.
- Redirects still carry no caching headers.
