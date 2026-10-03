#!/usr/bin/env bash
# Run one recorded load test and collect everything into results/RUN_ID/.
#
#   run.sh RUN_ID LOAD_SERVER "SYSTEM_SERVER ..." K6_SCRIPT [k6 args...]
#
# Records every machine's resources once a second during the run, saves k6's
# per-request output, the machine sizes, the git commit and the script's hash,
# then analyses the run. Refuses to overwrite an existing run.
source "$(dirname "$0")/../cloud/lib.sh"

run_id="$1" load="$2" systems="$3" script="$4"; shift 4
out="$SFP_ROOT/episodes/$SFP_EPISODE/results/$run_id"
[[ -e "$out" ]] && { echo "run $run_id already exists at $out" >&2; exit 1; }
mkdir -p "$out"

scp_from() { scp -q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts" "root@$1:$2" "$3"; }
scp_to()   { scp -q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts" "$1" "root@$2:$3"; }

load_ip="$(sfp_ip "$load")"
machines=("$load")
for s in $systems; do machines+=("$s"); done

# Machine details for the record.
{
  echo "["
  sep=""
  for m in "${machines[@]}"; do
    hcloud server describe "$m" -o json |
      jq --arg role "$( [[ "$m" == "$load" ]] && echo load || echo system )" \
        '{name, role: $role, type: .server_type.name, cores: .server_type.cores, cpu_type: .server_type.cpu_type,
          architecture: .server_type.architecture, memory_gb: .server_type.memory, location: .datacenter.location.name}' |
      sed "1s/^/$sep/"
    sep=","
  done
  echo "]"
} > "$out/machines.json"

cp "$script" "$out/$(basename "$script")"
scp_to "$script" "$load_ip" /opt/sfp/script.js

start_recorder() { sfp_ssh "$1" "nohup python3 /opt/sfp/recorder.py /opt/sfp/metrics.csv node k6 >/dev/null 2>&1 & echo \$! > /opt/sfp/recorder.pid"; }
stop_recorder()  { sfp_ssh "$1" 'kill "$(cat /opt/sfp/recorder.pid)" 2>/dev/null || true'; }

for m in "${machines[@]}"; do start_recorder "$(sfp_ip "$m")"; done
started=$(date -u +%FT%TZ)

echo "running $run_id: k6 $* (on $load)"
set +e
sfp_ssh "$load_ip" "cd /opt/sfp && rm -f k6.csv.gz summary.json && ulimit -n 1048576 && \
  k6 run --quiet --no-color --log-output=none --out csv=k6.csv.gz --summary-export=summary.json $(printf '%q ' "$@") script.js" \
  > "$out/k6-output.txt" 2>&1
k6_status=$?
set -e
ended=$(date -u +%FT%TZ)

for m in "${machines[@]}"; do
  ip="$(sfp_ip "$m")"
  stop_recorder "$ip"
  scp_from "$ip" /opt/sfp/metrics.csv "$out/metrics-$m.csv"
done
scp_from "$load_ip" /opt/sfp/k6.csv.gz "$out/k6.csv.gz"
scp_from "$load_ip" /opt/sfp/summary.json "$out/k6-summary.json" || true

dirty=$(git -C "$SFP_ROOT" status --porcelain | grep -q . && echo true || echo false)
jq -n --arg id "$run_id" --arg started "$started" --arg ended "$ended" \
  --arg commit "$(git -C "$SFP_ROOT" rev-parse HEAD)" --argjson dirty "$dirty" \
  --arg script "$(basename "$script")" --arg sha "$(shasum -a 256 "$script" | cut -d' ' -f1)" \
  --arg args "$*" --argjson k6_exit "$k6_status" --arg load "$load" \
  '{run_id: $id, started_utc: $started, ended_utc: $ended, git_commit: $commit, uncommitted_changes: $dirty,
    k6_script: $script, k6_script_sha256: $sha, k6_args: $args, k6_exit_code: $k6_exit, load_machine: $load}' \
  > "$out/run.json"

python3 "$SFP_ROOT/tools/run/analyze.py" "$out"
