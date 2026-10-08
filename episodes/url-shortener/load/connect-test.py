#!/usr/bin/env python3
"""Run on the load machine: open plain TCP connections to HOST:443, 20 a
second for 60 s, and report how long connecting took (no HTTP, no TLS)."""
import socket, sys, time

host = sys.argv[1]
times = []
end = time.time() + 60
while time.time() < end:
    s = time.perf_counter()
    try:
        c = socket.create_connection((host, 443), timeout=5)
        times.append((time.perf_counter() - s) * 1000)
        c.close()
    except OSError:
        times.append(5000.0)
    time.sleep(0.05)
times.sort()
q = lambda p: times[int(p * (len(times) - 1))]
print(f"TCP connect to {host}:443 x{len(times)}: p50 {q(.5):.2f} ms, p99 {q(.99):.2f} ms, max {times[-1]:.1f} ms, over 20 ms: {sum(t > 20 for t in times)}")
