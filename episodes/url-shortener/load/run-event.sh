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

# Every link created during the run, plus the seeded sample, must still redirect correctly.
python3 - "$out" <<'PY'
import csv, gzip, sys
out = sys.argv[1]
pairs = [("code", "url")]
with gzip.open(f"{out}/k6.csv.gz", "rt") as f:
    for r in csv.DictReader(f):
        if r["metric_name"] == "created_link":
            tags = dict(t.split("=", 1) for t in r["extra_tags"].split("&") if "=" in t)
            pairs.append((tags["code"], r["url"]))
created = len(pairs) - 1
# The first 1,000 sampled links are enough to show stored links still resolve.
with open(f"{out}/sample.csv") as f:
    pairs += [tuple(row) for row in list(csv.reader(f))[1:1001]]
csv.writer(open(f"{out}/check-pairs.csv", "w", newline="")).writerows(pairs)
print(f"checking {created} links created during the run and {len(pairs) - 1 - created} seeded links")
PY
scp "${scp_opts[@]}" "$here/check.py" "$out/check-pairs.csv" "root@$load_ip:/opt/sfp/"
sfp_ssh "$load_ip" "python3 /opt/sfp/check.py https://$system_ip /opt/sfp/check-pairs.csv /opt/sfp/check.json"
scp "${scp_opts[@]}" "root@$load_ip:/opt/sfp/check.json" "$out/check.json"

python3 "$here/judge.py" "$out" "$event"
