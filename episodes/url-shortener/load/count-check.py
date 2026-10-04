#!/usr/bin/env python3
"""After a run, compare the server's click counts with what the load generator sent.

    count-check.py TARGET TRUTH.csv OUT.json NOT_BEFORE_UNIX

TRUTH.csv has code,day,clicks rows counted from the load generator's own log
(successful redirects only). Waits until NOT_BEFORE_UNIX (60 s after the load
stopped: counts may be at most 60 s behind), then asks /links/<code>/stats for
each link. A count passes if it is within 1% of the truth (rounded down, so
small counts must be exact).
"""
import csv
import http.client
import json
import ssl
import sys
import time
from urllib.parse import urlparse

target, truth_path, out_path, not_before = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
host, port = urlparse(target).hostname, urlparse(target).port or 443
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

time.sleep(max(0, not_before - time.time()))
checked_at = time.time()

results = []
for row in csv.DictReader(open(truth_path)):
    conn = http.client.HTTPSConnection(host, port, context=ctx, timeout=10)
    conn.request("GET", f"/links/{row['code']}/stats")
    reply = json.loads(conn.getresponse().read() or b"{}")
    conn.close()
    truth = int(row["clicks"])
    got = int(reply.get("clicks_per_day", {}).get(row["day"], 0))
    allowed = truth // 100
    results.append({"code": row["code"], "day": row["day"], "truth": truth, "server": got,
                    "diff": got - truth, "allowed": allowed, "ok": abs(got - truth) <= allowed})

bad = [r for r in results if not r["ok"]]
summary = {
    "checked_at_unix": round(checked_at),
    "links_checked": len(results),
    "links_outside_1pct": len(bad),
    "clicks_truth_total": sum(r["truth"] for r in results),
    "clicks_server_total": sum(r["server"] for r in results),
    "worst": sorted(results, key=lambda r: -abs(r["diff"]))[:10],
}
json.dump(summary, open(out_path, "w"), indent=2)
print(f"counts: {len(results)} links checked, {len(bad)} outside 1%; "
      f"truth {summary['clicks_truth_total']} vs server {summary['clicks_server_total']} clicks")
