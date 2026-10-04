#!/usr/bin/env python3
"""Turn one run's raw files into per-window numbers and a validity verdict.

    analyze.py RESULTS/RUN_ID [WINDOW_SECONDS]

Reads k6.csv.gz (one row per request metric) and metrics-*.csv (one row per
second per machine). Latency is visit_duration: connect + TLS handshake +
request + response, what a new visitor waits for. Writes windows.csv and prints a table. A window is
INVALID if the load machine was over 70% CPU: the measuring tool itself fell
behind, so its numbers cannot be trusted. SATURATED if k6 skipped requests
while the load machine had spare CPU: the system under test stopped keeping
up, and the latency shown is a lower bound.
"""
import csv
import glob
import gzip
import json
import os
import sys
from collections import defaultdict

out = sys.argv[1]
window = int(sys.argv[2]) if len(sys.argv) > 2 else 10
LOAD_CPU_LIMIT = 70.0


def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo)


reqs = defaultdict(int)
failed = defaultdict(int)
dropped = defaultdict(float)
durations = defaultdict(list)       # all visits
kind_durations = defaultdict(list)  # (window, kind) -> visits, when the script tags kind=...
wrong = defaultdict(int)
statuses = defaultdict(lambda: defaultdict(int))

with gzip.open(os.path.join(out, "k6.csv.gz"), "rt") as f:
    for row in csv.DictReader(f):
        name = row["metric_name"]
        ts = int(float(row["timestamp"]))
        w = ts - ts % window
        if name == "http_reqs":
            reqs[w] += 1
            statuses[w][row.get("status") or "none"] += 1
        elif name == "http_req_failed" and float(row["metric_value"]) == 1:
            failed[w] += 1
        elif name == "visit_duration":
            v = float(row["metric_value"])
            durations[w].append(v)
            tags = dict(t.split("=", 1) for t in (row.get("extra_tags") or "").split("&") if "=" in t)
            if "kind" in tags:
                kind_durations[(w, tags["kind"])].append(v)
        elif name == "wrong_redirect":
            wrong[w] += int(float(row["metric_value"]))
        elif name == "dropped_iterations":
            dropped[w] += float(row["metric_value"])

machines = {m["name"]: m for m in json.load(open(os.path.join(out, "machines.json")))}
cpu = {}  # machine -> window -> (avg busy %, max single-core busy %)
mem = {}
app = {}  # machine -> process -> window -> max CPU % of that program (100 = one full core)
steal = {}  # machine -> window -> max % of CPU time taken by the host for other machines
queue = {}  # machine -> window -> (max connections waiting in the 443 accept queue, connections turned away)
PROCS = ("node", "nginx")
for path in glob.glob(os.path.join(out, "metrics-*.csv")):
    m = os.path.basename(path)[len("metrics-"):-len(".csv")]
    per_w = defaultdict(list)
    mem_w = defaultdict(list)
    app_w = defaultdict(lambda: defaultdict(list))
    steal_w = defaultdict(list)
    queue_w = defaultdict(list)
    with open(path, errors="replace") as f:
        # A power cut can leave the end of a machine's log as zero bytes
        # (length recorded, data never written); skip lines that don't parse.
        for row in csv.DictReader(line for line in f if "\x00" not in line):
            if not (row.get("ts") or "").isdigit():
                continue
            ts = int(row["ts"])
            cores = [float(v) for k, v in row.items() if k.endswith("_busy_pct")]
            per_w[ts - ts % window].append((sum(cores) / len(cores), max(cores)))
            mem_w[ts - ts % window].append(int(row["mem_used_mb"]))
            for p in PROCS:
                if row.get(f"{p}_cpu_pct") not in (None, ""):
                    app_w[p][ts - ts % window].append(float(row[f"{p}_cpu_pct"]))
            if row.get("cpu_steal_pct") not in (None, ""):
                steal_w[ts - ts % window].append(float(row["cpu_steal_pct"]))
            if row.get("accept_queue_443") not in (None, ""):
                queue_w[ts - ts % window].append((int(row["accept_queue_443"]), int(row["turned_away"])))
    cpu[m] = {w: (max(a for a, _ in v), max(c for _, c in v)) for w, v in per_w.items()}
    mem[m] = {w: max(v) for w, v in mem_w.items()}
    app[m] = {p: {w: max(v) for w, v in by_w.items()} for p, by_w in app_w.items()}
    steal[m] = {w: max(v) for w, v in steal_w.items()}
    queue[m] = {w: (max(q for q, _ in v), sum(t for _, t in v)) for w, v in queue_w.items()}

load = [m for m, info in machines.items() if info["role"] == "load"][0]
systems = [m for m, info in machines.items() if info["role"] == "system"]

rows = []
for w in sorted(reqs):
    d = sorted(durations[w])
    load_cpu = cpu.get(load, {}).get(w, (None, None))[0]
    invalid = []
    saturated = False
    if load_cpu is not None and load_cpu > LOAD_CPU_LIMIT:
        invalid.append(f"load CPU {load_cpu:.0f}%")
    if dropped[w] > 0:
        if invalid:
            invalid.append(f"{dropped[w]:.0f} dropped")
        else:
            # The load machine had spare CPU, so k6 skipped requests because
            # every virtual user was stuck waiting on a slow server: the system
            # is not keeping up. Latency here is a lower bound.
            saturated = True
    row = {
        "window_start": w,
        "req_per_s": round(reqs[w] / window, 1),
        "p50_ms": round(pct(d, 50), 1) if d else None,
        "p95_ms": round(pct(d, 95), 1) if d else None,
        "p99_ms": round(pct(d, 99), 1) if d else None,
        "error_pct": round(100 * failed[w] / reqs[w], 2),
        "wrong_redirects": wrong[w],
        "statuses": " ".join(f"{k}:{v}" for k, v in sorted(statuses[w].items())),
        "load_cpu_pct": round(load_cpu, 0) if load_cpu is not None else None,
    }
    for kind in sorted({k for (_, k) in kind_durations}):
        kd = sorted(kind_durations.get((w, kind), []))
        row[f"{kind}_p99_ms"] = round(pct(kd, 99), 1) if kd else None
    for s in systems:
        avg, top = cpu.get(s, {}).get(w, (None, None))
        row[f"{s}_cpu_avg_pct"] = round(avg, 0) if avg is not None else None
        row[f"{s}_cpu_top_core_pct"] = round(top, 0) if top is not None else None
        row[f"{s}_mem_mb"] = mem.get(s, {}).get(w)
        for p in PROCS:
            if p in app.get(s, {}):
                row[f"{s}_{p}_cpu_pct"] = app[s][p].get(w)
        row[f"{s}_steal_pct"] = steal.get(s, {}).get(w)
        if s in queue and queue[s]:
            q = queue[s].get(w, (None, None))
            row[f"{s}_accept_queue_max"], row[f"{s}_turned_away"] = q
    if invalid:
        row["valid"] = "INVALID: " + ", ".join(invalid)
    elif saturated:
        row["valid"] = f"SATURATED: {dropped[w]:.0f} requests not sent"
    else:
        row["valid"] = "ok"
    rows.append(row)

with open(os.path.join(out, "windows.csv"), "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(dict.fromkeys(k for r in rows for k in r)))
    writer.writeheader()
    writer.writerows(rows)

t0 = rows[0]["window_start"] if rows else 0
kinds = sorted({k for (_, k) in kind_durations})
cols = ["req_per_s", "p50_ms", "p99_ms"] + [f"{k}_p99_ms" for k in kinds] + ["error_pct", "load_cpu_pct"]
for s in systems:
    cols += [f"{s}_cpu_avg_pct", f"{s}_cpu_top_core_pct"] + [f"{s}_{p}_cpu_pct" for p in PROCS if p in app.get(s, {})] + [f"{s}_steal_pct"] + ([f"{s}_accept_queue_max", f"{s}_turned_away"] if queue.get(s) else [])
print("t(s)  " + "  ".join(c.replace(f"{systems[0]}_", "sys_") if systems else c for c in cols) + "  valid")
for r in rows:
    print(f"{r['window_start'] - t0:>4}  " + "  ".join(f"{str(r.get(c)):>{len(c) if not systems else 8}}" for c in cols) + f"  {r['valid']}")
print(f"\nwrote {os.path.join(out, 'windows.csv')}")
