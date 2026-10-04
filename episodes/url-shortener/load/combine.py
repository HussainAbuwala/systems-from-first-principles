#!/usr/bin/env python3
"""Combine repeated runs of one event into a single verdict (docs/MEASUREMENT.md#repeats).

    combine.py EVENT STAGE RUN_ID [RUN_ID ...]

Reads each run's verdict.json, prints best / median / worst of the key
measures, and writes results/verdicts/EVENT-STAGE.json.
"""
import json
import os
import statistics
import sys

event, stage, run_ids = sys.argv[1], sys.argv[2], sys.argv[3:]
results = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")
runs = [json.load(open(os.path.join(results, r, "verdict.json"))) for r in run_ids]

verdicts = [r["verdict"] for r in runs]
if len(set(verdicts)) == 1 and verdicts[0] in ("PASS", "FAIL"):
    combined = verdicts[0]
else:
    combined = "INCONSISTENT"

keys = ["redirect_p50_ms", "redirect_p99_ms", "create_p99_ms", "name_create_p99_ms", "error_pct",
        "wrong_redirects", "checker_problems", "rounds_exactly_one_winner"]
spread = {}
for k in keys:
    vals = [r["measures"].get(k) for r in runs if r["measures"].get(k) is not None]
    if vals:
        spread[k] = {"best": min(vals), "median": statistics.median(vals), "worst": max(vals), "runs": vals}

out = {"event": event, "stage": stage, "verdict": combined, "runs": dict(zip(run_ids, verdicts)),
       "reasons": {rid: r["reasons"] for rid, r in zip(run_ids, runs)}, "spread": spread}
os.makedirs(os.path.join(results, "verdicts"), exist_ok=True)
json.dump(out, open(os.path.join(results, "verdicts", f"{event}-{stage}.json"), "w"), indent=2, ensure_ascii=False)

print(f"{event} on {stage}: {combined}   ({', '.join(f'{r}={v}' for r, v in zip(run_ids, verdicts))})")
print(f"  {'measure':<28}{'best':>10}{'median':>10}{'worst':>10}")
for k, v in spread.items():
    print(f"  {k:<28}{v['best']:>10}{v['median']:>10}{v['worst']:>10}")
