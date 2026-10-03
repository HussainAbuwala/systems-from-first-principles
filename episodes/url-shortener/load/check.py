#!/usr/bin/env python3
"""After a run, re-open links and confirm each still redirects correctly.

    check.py TARGET PAIRS.csv OUT.json

PAIRS.csv has code,url rows: every link created during the run plus a sample
of seeded ones. Each must answer 301 with exactly its URL; a few codes that
were never issued must answer 404. Also records the caching instructions on
redirects (Cache-Control, Expires), used to judge levels 5 and 9. Runs on the
load machine, one request at a time, no redirects followed.
"""
import csv
import http.client
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


pairs = list(csv.DictReader(open(pairs_path)))
problems = []
caching = Counter()
for p in pairs:
    try:
        status, location, cache_control, expires = get(p["code"])
    except Exception as e:  # timeouts and connection errors count as problems
        problems.append({"code": p["code"], "error": str(e)})
        continue
    caching[f"Cache-Control={cache_control!r} Expires={expires!r}"] += 1
    if status != 301 or location != p["url"]:
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
    "redirect_caching_headers": dict(caching),
}
json.dump(result, open(out_path, "w"), indent=2)
print(f"checked {len(pairs)} links: {len(problems)} problems; caching headers seen: {dict(caching)}")
