#!/usr/bin/env python3
"""Summarise a lock-probe.mjs recording: every period the database's write
lock was held for 500 ms or more, with Litestream's reported step, per-disk
I/O and Litestream's CPU around it.

    lock-probe-report.py PROBE_DIR [RUN_STARTED_UNIX]
"""
import collections
import json
import os
import sys

probe_dir = sys.argv[1]
run_start = float(sys.argv[2]) if len(sys.argv) > 2 else None
rows = [json.loads(l) for l in open(os.path.join(probe_dir, "probe.jsonl"))]
TICKS = 100  # clock ticks per second on Linux
SECTOR = 512


def rate(a, b, disk, key):
    dt = (b["t"] - a["t"]) / 1000
    return (b["disk"][disk][key] - a["disk"][disk][key]) / dt if dt > 0 else 0


def at(r):
    s = f"{r['t'] / 1000:.1f}"
    if run_start:
        s += f" (run {r['t'] / 1000 - run_start:+.0f} s)"
    return s


# Lock-held periods.
periods, cur = [], None
for r in rows:
    if not r["lockFree"]:
        cur = cur or []
        cur.append(r)
    elif cur:
        periods.append(cur)
        cur = None
if cur:
    periods.append(cur)

t0 = rows[0]["t"]
print(f"{len(rows)} samples over {(rows[-1]['t'] - t0) / 1000:.0f} s; lock held in {sum(len(p) for p in periods)} samples")
print(f"periods held >= 500 ms: {sum(1 for p in periods if p[-1]['t'] - p[0]['t'] >= 500)}\n")
for p in periods:
    dur = p[-1]["t"] - p[0]["t"] + 250
    if dur < 500:
        continue
    phases = collections.Counter(
        f"{(x['litestream'] or {}).get('operation')}/{(x['litestream'] or {}).get('phase')}"
        + (" (active)" if (x["litestream"] or {}).get("active") else "")
        for x in p
    )
    i0 = rows.index(p[0])
    i1 = rows.index(p[-1])
    a, b = rows[max(0, i0 - 1)], rows[min(len(rows) - 1, i1 + 1)]
    secs = (b["t"] - a["t"]) / 1000
    ls_cpu = (b["lsTicks"] - a["lsTicks"]) / TICKS / secs * 100 if a["lsTicks"] and b["lsTicks"] else None
    print(f"held {dur / 1000:.2f} s from {at(p[0])}")
    print(f"  Litestream steps seen: {dict(phases)}")
    for d, name in (("sda", "server disk"), ("sdb", "Volume")):
        rmb = rate(a, b, d, "rs") * SECTOR / 1e6
        wmb = rate(a, b, d, "ws") * SECTOR / 1e6
        busy = rate(a, b, d, "busy") / 10  # ms of I/O per s -> %
        print(f"  {name}: read {rmb:.1f} MB/s, write {wmb:.1f} MB/s, busy {busy:.0f}%")
    if ls_cpu is not None:
        print(f"  Litestream CPU: {ls_cpu:.0f}% of one core")
    print()

# What the goroutine dumps say Litestream was blocked on.
gdir = os.path.join(probe_dir, "goroutines")
if os.path.isdir(gdir):
    for f in sorted(os.listdir(gdir))[:6]:
        text = open(os.path.join(gdir, f)).read()
        blocks = [g for g in text.split("\n\n") if "litestream" in g and ("checkpoint" in g.lower() or "Checkpoint" in g)]
        print(f"goroutine dump {f}: {len(blocks)} goroutines in checkpoint code")
        for g in blocks[:2]:
            lines = g.splitlines()
            print("  " + lines[0])
            for l in [l for l in lines[1:] if l.strip() and not l.startswith("\t")][:8]:
                print("    " + l.strip())
        print()
