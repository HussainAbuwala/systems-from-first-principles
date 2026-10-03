#!/usr/bin/env python3
"""Judge one run against its level's pass rules from the locked event script.

    judge.py RESULTS/RUN_ID EVENT [WARMUP_SECONDS]

Measures only after the warm-up. A run with any INVALID window in that
period (load machine over 70% CPU) cannot pass or fail: it must be redone.
Writes verdict.json next to the run's other files.
"""
import csv
import gzip
import json
import os
import sys

out, event = sys.argv[1], sys.argv[2]
warmup = int(sys.argv[3]) if len(sys.argv) > 3 else 60

# Default pass criteria from event-script.md; levels add their own checks later.
RULES = {"redirect_p99_ms": 100.0, "create_p99_ms": 300.0, "error_pct": 0.1}


def pct(vals, p):
    vals = sorted(vals)
    if not vals:
        return None
    k = (len(vals) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(vals) - 1)
    return vals[lo] + (vals[hi] - vals[lo]) * (k - lo)


rows = []
with gzip.open(os.path.join(out, "k6.csv.gz"), "rt") as f:
    rows = [r for r in csv.DictReader(f) if r["metric_name"] in ("visit_duration", "http_reqs", "http_req_failed", "wrong_redirect", "name_round")]
rounds = [r for r in rows if r["metric_name"] == "name_round"]
rows = [r for r in rows if r["metric_name"] != "name_round"]
start = min(int(float(r["timestamp"])) for r in rows)
measured = [r for r in rows if int(float(r["timestamp"])) >= start + warmup]


def tags(r):
    return dict(t.split("=", 1) for t in (r.get("extra_tags") or "").split("&") if "=" in t)


def kind(r):
    return tags(r).get("kind")


redirects = [float(r["metric_value"]) for r in measured if r["metric_name"] == "visit_duration" and kind(r) == "redirect"]
creates = [float(r["metric_value"]) for r in measured if r["metric_name"] == "visit_duration" and kind(r) == "create"]
name_creates = [float(r["metric_value"]) for r in measured if r["metric_name"] == "visit_duration" and kind(r) == "name_create"]
reqs = sum(1 for r in measured if r["metric_name"] == "http_reqs")
failed = sum(1 for r in measured if r["metric_name"] == "http_req_failed" and float(r["metric_value"]) == 1)
wrong = sum(int(float(r["metric_value"])) for r in measured if r["metric_name"] == "wrong_redirect")

windows = list(csv.DictReader(open(os.path.join(out, "windows.csv"))))
invalid = [w for w in windows if int(w["window_start"]) >= start + warmup and w["valid"].startswith("INVALID")]
check = json.load(open(os.path.join(out, "check.json"))) if os.path.exists(os.path.join(out, "check.json")) else None

measures = {
    "measured_seconds": max(int(float(r["timestamp"])) for r in rows) - start - warmup,
    "redirects": len(redirects),
    "creates": len(creates),
    "redirect_p50_ms": round(pct(redirects, 50), 1) if redirects else None,
    "redirect_p99_ms": round(pct(redirects, 99), 1) if redirects else None,
    "create_p99_ms": round(pct(creates, 99), 1) if creates else None,
    "name_create_requests": len(name_creates),
    "name_create_p99_ms": round(pct(name_creates, 99), 1) if name_creates else None,
    "error_pct": round(100 * failed / reqs, 3) if reqs else None,
    "wrong_redirects": wrong,
    "checker_problems": check["problems"] if check else None,
    "checker_unloaded_ms": check.get("unloaded_ms") if check else None,
}

expected_rounds = int(os.environ.get("CONTENTION_ROUNDS", "0"))
contenders = int(os.environ.get("CONTENTION_SIZE", "50"))
if expected_rounds or rounds:
    outcomes = [(int(tags(r)["winners"]), int(tags(r)["taken"])) for r in rounds]
    measures["name_rounds"] = len(outcomes)
    measures["rounds_exactly_one_winner"] = sum(1 for w, t in outcomes if w == 1 and t == contenders - 1)
    measures["rounds_two_or_more_winners"] = sum(1 for w, _ in outcomes if w > 1)
    measures["rounds_no_winner"] = sum(1 for w, _ in outcomes if w == 0)
    measures["rounds_other_answers"] = sum(1 for w, t in outcomes if w == 1 and t != contenders - 1)

failures = []
if measures["redirect_p99_ms"] is not None and measures["redirect_p99_ms"] >= RULES["redirect_p99_ms"]:
    failures.append(f"redirect p99 {measures['redirect_p99_ms']} ms ≥ {RULES['redirect_p99_ms']:.0f}")
if measures["create_p99_ms"] is not None and measures["create_p99_ms"] >= RULES["create_p99_ms"]:
    failures.append(f"create p99 {measures['create_p99_ms']} ms ≥ {RULES['create_p99_ms']:.0f}")
if measures["error_pct"] is not None and measures["error_pct"] >= RULES["error_pct"]:
    failures.append(f"errors {measures['error_pct']}% ≥ {RULES['error_pct']}%")
if measures["name_create_p99_ms"] is not None and measures["name_create_p99_ms"] >= RULES["create_p99_ms"]:
    failures.append(f"name create p99 {measures['name_create_p99_ms']} ms ≥ {RULES['create_p99_ms']:.0f}")
if wrong:
    failures.append(f"{wrong} wrong redirects")
if "name_rounds" in measures:
    if expected_rounds and measures["name_rounds"] < expected_rounds:
        failures.append(f"only {measures['name_rounds']} of {expected_rounds} contention rounds completed")
    if measures["rounds_exactly_one_winner"] != measures["name_rounds"]:
        failures.append(f"only {measures['rounds_exactly_one_winner']} of {measures['name_rounds']} rounds had exactly one winner and {contenders - 1} 'taken'")
if check is None:
    failures.append("link checker did not run")
elif check["problems"]:
    failures.append(f"link checker found {check['problems']} problems")

if invalid:
    verdict = "INVALID"
    reasons = [f"{len(invalid)} windows where the load machine could not keep up; redo the run"]
else:
    verdict = "FAIL" if failures else "PASS"
    reasons = failures

result = {"event": event, "verdict": verdict, "reasons": reasons, "rules": RULES, "measures": measures}
json.dump(result, open(os.path.join(out, "verdict.json"), "w"), indent=2, ensure_ascii=False)
print(f"{event}: {verdict}")
for k, v in measures.items():
    print(f"  {k}: {v}")
for r in reasons:
    print(f"  - {r}")
