#!/usr/bin/env python3
"""After a run, re-open links and confirm each still redirects correctly.

    check.py TARGET PAIRS.csv OUT.json

PAIRS.csv has code,url rows: every link created during the run plus a sample
of seeded ones; url GONE means the link was taken down (E09) and must answer 410. Each must answer 301 with exactly its URL; a few codes that
were never issued must answer 404. Also records the caching instructions on
redirects (Cache-Control, Expires), used to judge levels 5 and 9. Runs on the
load machine, one request at a time, no redirects followed.
"""
import csv
import http.client
import re
import statistics
import time
import json
import ssl
import sys
from collections import Counter
from urllib.parse import urlparse

target, pairs_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
host = urlparse(target).hostname
port = urlparse(target).port or 443
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE  # self-made certificate


def get(code):
    conn = http.client.HTTPSConnection(host, port, context=ctx, timeout=10)
    try:
        conn.request("GET", f"/{code}")
        res = conn.getresponse()
        res.read()
        return res.status, res.getheader("Location"), res.getheader("Cache-Control"), res.getheader("Expires")
    finally:
        conn.close()


GENERATED = re.compile(r"^[0-9A-Za-z]{1,7}$")
pairs = list(csv.DictReader(open(pairs_path)))
problems = []
caching = Counter()
timings = {"generated": [], "name": []}
for p in pairs:
    try:
        started = time.perf_counter()
        status, location, cache_control, expires = get(p["code"])
        timings["generated" if GENERATED.match(p["code"]) else "name"].append(1000 * (time.perf_counter() - started))
    except Exception as e:  # timeouts and connection errors count as problems
        problems.append({"code": p["code"], "error": str(e)})
        continue
    caching[f"Cache-Control={cache_control!r} Expires={expires!r}"] += 1
    if p["url"] == "GONE":  # taken down during the run (E09): must answer 410
        if status != 410:
            problems.append({"code": p["code"], "status": status, "location": location, "expected": "410 Gone"})
    elif status != 301 or location != p["url"]:
        problems.append({"code": p["code"], "status": status, "location": location, "expected": p["url"]})

# Codes far beyond anything issued must not resolve.
for code in ("zzzzzzz", "ZZZZZZY", "!!", "toolongcode"):
    status = get(code)[0]
    if status != 404:
        problems.append({"code": code, "status": status, "expected": 404})

result = {
    "links_checked": len(pairs),
    "problems": len(problems),
    "examples": problems[:20],
    # Every problem's code, so a judge can tell which links were lost (E07).
    "problem_codes": [p["code"] for p in problems],
    # Every problem in full: a lost link (404) and a wrong destination differ.
    "all_problems": problems,
    "redirect_caching_headers": dict(caching),
    # One request at a time, no other load: what each lookup path costs alone.
    "unloaded_ms": {kind: {"count": len(v), "median": round(statistics.median(v), 2) if v else None,
                           "p99": round(sorted(v)[int(0.99 * (len(v) - 1))], 2) if v else None}
                    for kind, v in timings.items()},
}
json.dump(result, open(out_path, "w"), indent=2)
print(f"checked {len(pairs)} links: {len(problems)} problems; caching headers seen: {dict(caching)}")
print(f"unloaded visit time by path: {result['unloaded_ms']}")
