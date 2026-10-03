#!/usr/bin/env bash
# Delete our servers and record what each one cost in the spend ledger.
#
#   delete.sh NAME [REASON]      one server
#   delete.sh --all [REASON]     every server labelled series=sfp, including "keep" ones
#   delete.sh --tests [REASON]   every series=sfp server without a keep label
source "$(dirname "$0")/lib.sh"

target="$1" reason="${2:-manual}"

case "$target" in
  --all)   selector="$SFP_SELECTOR" ;;
  --tests) selector="$SFP_SELECTOR,!keep" ;;
  *)       selector="" ;;
esac

if [[ -n "$selector" ]]; then
  names=$(hcloud server list -l "$selector" -o json | jq -r '.[].name')
else
  names="$target"
fi

sfp_ledger_init
for name in $names; do
  info=$(hcloud server describe "$name" -o json)
  type=$(jq -r '.server_type.name' <<<"$info")
  role=$(jq -r '.labels.role // ""' <<<"$info")
  created=$(jq -r '.created' <<<"$info")
  created_epoch=$(python3 -c 'import sys,datetime;print(int(datetime.datetime.fromisoformat(sys.argv[1]).timestamp()))' "$created")
  now=$(date +%s)
  read -r hours eur < <(sfp_cost "$type" "$created_epoch" "$now")
  ip=$(jq -r '.public_net.ipv4.ip' <<<"$info")
  hcloud server delete "$name" > /dev/null
  ssh-keygen -R "$ip" -f "$SFP_ROOT/tools/cloud/.known_hosts" >/dev/null 2>&1 || true
  echo "$name,$type,$role,$(date -u -r "$created_epoch" +%FT%TZ),$(date -u -r "$now" +%FT%TZ),$hours,$eur,$reason" >> "$SFP_LEDGER"
  echo "deleted $name ($type, $hours h, €$eur)"
done
