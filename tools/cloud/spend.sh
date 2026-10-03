#!/usr/bin/env bash
# What this episode has spent: deleted servers from the ledger, plus what
# servers that still exist have cost so far.
source "$(dirname "$0")/lib.sh"

sfp_ledger_init
spent=$(tail -n +2 "$SFP_LEDGER" | awk -F, '{s += $7} END {printf "%.4f", s}')
echo "Deleted servers (ledger):  €$spent"

running=0
while read -r name type created; do
  [[ -z "$name" ]] && continue
  created_epoch=$(python3 -c 'import sys,datetime;print(int(datetime.datetime.fromisoformat(sys.argv[1]).timestamp()))' "$created")
  read -r hours eur < <(sfp_cost "$type" "$created_epoch" "$(date +%s)")
  echo "Still running: $name ($type, $hours h so far, €$eur)"
  running=$(python3 -c "print(f'{$running + $eur:.4f}')")
done < <(hcloud server list -l "$SFP_SELECTOR" -o json | jq -r '.[] | "\(.name) \(.server_type.name) \(.created)"')

python3 -c "print(f'Total so far:              €{$spent + $running:.2f}  (Hetzner bills per started hour; excludes the IPv4 address fee)')"
