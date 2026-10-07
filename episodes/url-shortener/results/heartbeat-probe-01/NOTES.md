# heartbeat-probe-01: lock probe after a fresh full copy, no traffic, heartbeat on (stage 7 attempt 2)

**Purpose:** repeat `e08-06`'s quiet scenario (100 M links reseeded, no traffic) with the heartbeat (`fc2a12c`), to see whether Litestream still holds the write lock for about 30 s after a fresh full copy.

**Setup:** `reset-and-seed.sh` (the app starts first, so the heartbeat saves every second; Litestream starts one second later and makes its full copy); `load/lock-probe.mjs` on `sfp-app` every 250 ms for 720 s, 13:24:47–13:36:47 UTC (the SSH call again waited for the probe despite `setsid nohup … </dev/null`; it still recorded the intended window). Litestream: full copy finished 13:27:12, whole-copy merges at level 1 (13:28:02) and level 2 (13:32:16).

**Result:** the lock was found taken in 5 of 2,880 checks, each an isolated single check (held under 250 ms); no hold of 500 ms or more, no goroutine dumps. In `e08-06` (same scenario, no heartbeat) it was held for 30.5 s while Litestream's checkpoint scanned the full copy. Idle-server check before the probe: Litestream wrote one 196-byte change file per second.
