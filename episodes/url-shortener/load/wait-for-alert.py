#!/usr/bin/env python3
"""Wait until Better Stack opens an incident for a monitor, then say when.

    wait-for-alert.py MONITOR_ID NOT_BEFORE_UNIX [TIMEOUT_SECONDS]

Polls Better Stack's incidents API every 5 s (token: BETTER_STACK_TOKEN) for an
incident on MONITOR_ID that started at or after NOT_BEFORE_UNIX, and prints one
JSON line: the incident, Better Stack's start time, and when we saw it. In an
E07 run this stands in for a person reading the alert email. Exits 1 on timeout.
"""
import datetime
import json
import os
import sys
import time
import urllib.request

monitor, not_before = sys.argv[1], int(sys.argv[2])
timeout = int(sys.argv[3]) if len(sys.argv) > 3 else 1800
token = os.environ["BETTER_STACK_TOKEN"]


def unix(stamp):
    return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()


deadline = time.time() + timeout
while time.time() < deadline:
    try:
        req = urllib.request.Request(
            "https://uptime.betterstack.com/api/v3/incidents?per_page=20",
            headers={"Authorization": f"Bearer {token}"},
        )
        incidents = json.load(urllib.request.urlopen(req, timeout=10))["data"]
    except Exception as e:  # keep polling through a failed request
        print(f"polling Better Stack failed: {e}", file=sys.stderr)
        incidents = []
    for i in incidents:
        a = i["attributes"]
        on = (i.get("relationships", {}).get("monitor", {}).get("data") or {}).get("id")
        if str(on) == str(monitor) and a.get("started_at") and unix(a["started_at"]) >= not_before:
            print(json.dumps({
                "incident_id": i["id"],
                "incident_cause": a.get("cause"),
                "incident_started_unix": round(unix(a["started_at"]), 1),
                "alert_seen_unix": round(time.time(), 1),
            }))
            sys.exit(0)
    time.sleep(5)
print(f"no Better Stack incident for monitor {monitor} within {timeout} s", file=sys.stderr)
sys.exit(1)
