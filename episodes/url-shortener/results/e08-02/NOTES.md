# e08-02: E08 10% of Bitly, against stage 6 (diagnostic repeat)

**Verdict: FAIL** on create p99: 847.7 ms against 300 ms, as in `e08-01`; everything else passes (redirect p99 17.2 ms, 0% errors, links correct, counts exact: 100,086 = 100,086). Purpose: the same run with Litestream's CPU recorded (recorder now tracks `litestream`), to name what holds creates back. Reseeded 100 M links first; Litestream's first full copy 1.7 GB.

**What the recording shows (30 s averages):**

| Seconds into run | Litestream CPU (% of one core) | Node | nginx | iowait | Disk writes |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0–90 | 20–85 | 23 | 92–113 | 6–7% | 6–7 MB/s |
| 90–210 | **121–135** | 20–21 | 88–94 | 7% | **19–25 MB/s** |
| 210–360 | 66–85 | 22 | 102–106 | 7% | 10 MB/s |

Create p99 per 10 s window: about 45–180 ms in steady operation, **0.8–1.4 s between about 60 and 200 s**. Litestream's log shows two compactions rewriting the whole 1.7 GB copy: level 1 at 15 s (warm-up) and level 2 finishing at about 200 s. They contain the whole copy because the first full copy is in their first window. They recur after every fresh copy (each reseed and each restore), the first time the hourly level gathers it, and with Litestream's daily full copy.

**Why creates wait:** each create waits for Litestream to write and flush a small file to the Volume. Litestream's source (v0.5.17) shows its compaction does not hold the lock that a sync takes, so it is not a queue behind a lock. The likely cause is the small flush waiting behind the compaction's heavy writes to the same Volume, plus CPU competition (Litestream above one core). Not separated further.

**Steady state without the big rewrite:** create p99 about 150–180 ms (under 300, about half the limit), with Litestream at 65–85% of a core for 20 copies a second.

**Litestream's merge schedule is configurable** (`levels`: by default every 30 s, 5 min and 1 h, plus a daily full copy).
