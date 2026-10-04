#!/usr/bin/env bash
# Run one level against the system, check every link afterwards, and judge it.
#
#   run-event.sh EVENT RUN_ID LOAD_SERVER SYSTEM_SERVER SAMPLE.csv k6-args...
#
# Example (E01): run-event.sh E01 e01-01 sfp-load sfp-stage0 results/seed-1k/sample.csv \
#                  -e REDIRECTS=1 -e CREATES=0.02 -e DURATION=6m
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

event="$1" run_id="$2" load="$3" system="$4" sample="$5"; shift 5
here="$(cd "$(dirname "$0")" && pwd)"
out="$SFP_ROOT/episodes/$SFP_EPISODE/results/$run_id"
load_ip="$(sfp_ip "$load")" system_ip="$(sfp_ip "$system")"
scp_opts=(-q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts")

scp "${scp_opts[@]}" "$sample" "root@$load_ip:/opt/sfp/sample.csv"
"$SFP_ROOT/tools/run/run.sh" "$run_id" "$load" "$system" "$here/level.js" \
  -e "TARGET=https://$system_ip" -e SAMPLE=/opt/sfp/sample.csv -e "RUN_ID=$run_id" "$@"
cp "$sample" "$out/sample.csv"

# E05 onward: compare the server's click counts with what the load generator sent.
# This must run before the link checker below: every link it opens is a real
# click the server counts, which the load generator's tally does not include.
if [[ "${CHECK_COUNTS:-0}" == "1" ]]; then
  python3 - "$out" <<'PY'
import csv, gzip, random, sys, collections, json, datetime
out = sys.argv[1]
truth = collections.Counter()
with gzip.open(f"{out}/k6.csv.gz", "rt") as f:
    for r in csv.DictReader(f):
        if r["metric_name"] == "http_reqs" and r["status"] == "301" and r["name"] in ("redirect", "viral"):
            day = datetime.datetime.fromtimestamp(int(float(r["timestamp"])), datetime.timezone.utc).date().isoformat()
            code = dict(t.split("=", 1) for t in (r["extra_tags"] or "").split("&") if "=" in t).get("code")
            if code: truth[(code, day)] += 1
ranked = [k for k, _ in truth.most_common()]
picked = ranked[:101] + random.sample(ranked[101:], min(1000, max(0, len(ranked) - 101)))
with open(f"{out}/count-truth.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["code", "day", "clicks"])
    for k in picked: w.writerow([k[0], k[1], truth[k]])
print(f"count truth: {sum(truth.values())} clicks over {len(truth)} links; checking {len(picked)}")
PY
  ended=$(jq -r .ended_utc "$out/run.json")
  not_before=$(( $(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$ended" +%s) + 60 ))
  scp "${scp_opts[@]}" "$here/count-check.py" "$out/count-truth.csv" "root@$load_ip:/opt/sfp/"
  sfp_ssh "$load_ip" "python3 /opt/sfp/count-check.py https://$system_ip /opt/sfp/count-truth.csv /opt/sfp/counts.json $not_before"
  scp "${scp_opts[@]}" "root@$load_ip:/opt/sfp/counts.json" "$out/counts.json"
fi


# Every link created during the run, plus the seeded sample, must still redirect correctly.
python3 - "$out" <<'PY'
import csv, gzip, sys
out = sys.argv[1]
pairs = [("code", "url")]
with gzip.open(f"{out}/k6.csv.gz", "rt") as f:
    for r in csv.DictReader(f):
        tags = dict(t.split("=", 1) for t in (r["extra_tags"] or "").split("&") if "=" in t)
        if r["metric_name"] == "created_link":
            pairs.append((tags["code"], r["url"]))
        elif r["metric_name"] == "name_round" and tags.get("winners") == "1":
            pairs.append((tags["round_name"], tags["winner_url"]))
created = len(pairs) - 1
# The first 1,000 sampled links are enough to show stored links still resolve.
with open(f"{out}/sample.csv") as f:
    pairs += [tuple(row) for row in list(csv.reader(f))[1:1001]]
csv.writer(open(f"{out}/check-pairs.csv", "w", newline="")).writerows(pairs)
print(f"checking {created} links created during the run (including winning names) and {len(pairs) - 1 - created} seeded links")
PY
scp "${scp_opts[@]}" "$here/check.py" "$out/check-pairs.csv" "root@$load_ip:/opt/sfp/"
sfp_ssh "$load_ip" "python3 /opt/sfp/check.py https://$system_ip /opt/sfp/check-pairs.csv /opt/sfp/check.json"
scp "${scp_opts[@]}" "root@$load_ip:/opt/sfp/check.json" "$out/check.json"

python3 "$here/judge.py" "$out" "$event"
