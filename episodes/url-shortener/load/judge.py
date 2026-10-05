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

# E06 (power cut) and E07 (machine lost): a failure during the run. Recovery =
# first successful redirect after the failure. Latency and error rules apply
# outside [failure, recovery].
failure = None
failure_path = os.path.join(out, "failure.json")
if os.path.exists(failure_path):
    failure = json.load(open(failure_path))
    # The power-off command returns a few seconds before the machine actually
    # stops, so the outage is taken from what visitors saw: the longest gap in
    # successful redirects starting within 60 s of the command.
    with gzip.open(os.path.join(out, "k6.csv.gz"), "rt") as f:
        ok = sorted(int(float(r["timestamp"])) for r in csv.DictReader(f)
                    if r["metric_name"] == "http_reqs" and r["status"] == "301")
    cut = failure["poweroff_unix"] if failure["kind"] == "power cut" else failure["lost_unix"]
    gaps = [(b - a, a, b) for a, b in zip(ok, ok[1:]) if abs(a - cut) <= 60]
    _, last_before, first_after = max(gaps) if gaps else (None, cut, None)
    failure["last_redirect_before_unix"] = last_before
    failure["first_redirect_after_unix"] = first_after
    failure["recovery_seconds"] = first_after - last_before if first_after else None
    # Requests sent during the outage can time out up to 10 s (the client
    # timeout) after recovery, so the excluded window extends by that much.
    outage = (last_before + 1, first_after + 10 if first_after else 10**12)
    failure["excluded_window_unix"] = list(outage)
    rows = [r for r in rows if not (outage[0] <= int(float(r["timestamp"])) <= outage[1])]
rows = [r for r in rows if r["metric_name"] != "name_round"]
start = min(int(float(r["timestamp"])) for r in rows)
measured = [r for r in rows if int(float(r["timestamp"])) >= start + warmup]


def tags(r):
    return dict(t.split("=", 1) for t in (r.get("extra_tags") or "").split("&") if "=" in t)


def kind(r):
    return tags(r).get("kind")


redirects = [float(r["metric_value"]) for r in measured if r["metric_name"] == "visit_duration" and kind(r) == "redirect"]
viral = [float(r["metric_value"]) for r in measured if r["metric_name"] == "visit_duration" and tags(r).get("link") == "viral"]
others = [float(r["metric_value"]) for r in measured if r["metric_name"] == "visit_duration" and kind(r) == "redirect" and tags(r).get("link") != "viral"]
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
    "viral_redirects": len(viral),
    "viral_redirect_p99_ms": round(pct(viral, 99), 1) if viral else None,
    "other_redirect_p99_ms": round(pct(others, 99), 1) if viral and others else None,
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
if failure is not None and failure["kind"] == "power cut":
    measures["power_cut_recovery_seconds"] = failure["recovery_seconds"]
    measures["power_off_seconds"] = failure["poweron_unix"] - failure["poweroff_unix"]
    if failure["recovery_seconds"] is None or failure["recovery_seconds"] > 300:
        failures.append(f"redirects not working again within 5 minutes of the power cut (recovery: {failure['recovery_seconds']} s)")
# E07: back within 1 hour of the loss; at most the last 5 minutes of
# acknowledged links lost. A checked link that answers 404 counts as lost; it
# is allowed only if it was acknowledged within the 5 minutes before the old
# server stopped answering (deletion takes a few seconds after the command, and
# the server keeps confirming links meanwhile). A link that redirects to the
# wrong page is never allowed: no wrong answer may be served.
lost_links_judged = False
if failure is not None and failure["kind"] == "machine lost":
    lost = failure["lost_unix"]
    first_after = failure["first_redirect_after_unix"]
    measures["back_after_loss_seconds"] = first_after - lost if first_after else None
    # Visitors' view of the loss: the old server's last successful redirect.
    died = max(lost, failure["last_redirect_before_unix"])
    measures["old_server_answered_after_delete_command_seconds"] = died - lost
    if "incident_started_unix" in failure:
        measures["detection_seconds"] = round(failure["incident_started_unix"] - lost)
        measures["alert_seen_to_recovery_start_seconds"] = round(failure["recovery_started_unix"] - failure["alert_seen_unix"])
    measures["recovery_script_seconds"] = failure["recovery_finished_unix"] - failure["recovery_started_unix"]
    measures["recovery_exit_code"] = failure["recovery_exit_code"]
    if measures["back_after_loss_seconds"] is None or measures["back_after_loss_seconds"] > 3600:
        failures.append(f"service not back within 1 hour of the loss (back after: {measures['back_after_loss_seconds']} s)")
    if "incident_started_unix" not in failure:
        failures.append("Better Stack raised no alert")
    acknowledged = {}
    with gzip.open(os.path.join(out, "k6.csv.gz"), "rt") as f:
        for r in csv.DictReader(f):
            if r["metric_name"] == "created_link":
                acknowledged[tags(r)["code"]] = float(r["timestamp"])
    measures["links_acknowledged_before_loss"] = sum(1 for t in acknowledged.values() if t <= died + 1)
    measures["links_acknowledged_in_last_5_min"] = sum(1 for t in acknowledged.values() if died - 300 <= t <= died + 1)
    if check is not None:
        problems = check.get("all_problems") or check.get("examples", [])
        if len(problems) < check["problems"]:
            failures.append("link checker recorded too few problem details to judge lost links")
        allowed = [p for p in problems if p.get("status") == 404 and p["code"] in acknowledged
                   and died - 300 <= acknowledged[p["code"]] <= died + 1]
        wrong = [p for p in problems if p.get("status") == 301]
        other = [p for p in problems if p not in allowed and p not in wrong]
        measures["links_lost_within_last_5_min"] = len(allowed)
        measures["links_redirecting_to_wrong_page"] = len(wrong)
        measures["links_lost_older_or_other_problems"] = len(other)
        if wrong:
            failures.append(f"{len(wrong)} checked links redirect to the wrong page: " + ", ".join(p["code"] for p in wrong[:5]))
        if other:
            failures.append(f"{len(other)} checked links lost or failing outside the allowed last 5 minutes")
        lost_links_judged = True
counts_path = os.path.join(out, "counts.json")
if os.path.exists(counts_path):
    counts = json.load(open(counts_path))
    measures["count_links_checked"] = counts["links_checked"]
    measures["count_links_outside_1pct"] = counts["links_outside_1pct"]
    measures["count_truth_vs_server"] = f"{counts['clicks_truth_total']} vs {counts['clicks_server_total']}"
    if counts["links_outside_1pct"]:
        failures.append(f"{counts['links_outside_1pct']} of {counts['links_checked']} links' click counts more than 1% off, 60 s after the load stopped")
# From E05 on, every redirect must stop browsers reusing it, or repeat clicks go uncounted.
if event in ("E05",) and check is not None:
    headers = check.get("redirect_caching_headers", {})
    reusable = sum(n for h, n in headers.items() if not any(x in h for x in ("no-store", "no-cache", "max-age=0")))
    measures["redirects_browsers_may_reuse"] = reusable
    if reusable:
        failures.append(f"{reusable} checked redirects let browsers reuse them without asking the server")
if check is None:
    failures.append("link checker did not run")
elif check["problems"] and not lost_links_judged:
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
