#!/usr/bin/env bash
# Create a labelled server, wait until SSH answers, print its IPv4 address.
#
#   create.sh NAME TYPE ROLE HOURS [USER_DATA_FILE]
#
# HOURS is the lifetime: the watchdog deletes the server after it. Use "keep"
# for a server that must stay up (stage 0 while friends use it).
source "$(dirname "$0")/lib.sh"

name="$1" type="$2" role="$3" hours="$4" user_data="${5:-}"

labels=(--label "$SFP_SELECTOR" --label "episode=$SFP_EPISODE" --label "role=$role")
if [[ "$hours" == "keep" ]]; then
  labels+=(--label "keep=true")
else
  labels+=(--label "delete-after=$(( $(date +%s) + hours * 3600 ))")
fi

extra=()
[[ -n "$user_data" ]] && extra+=(--user-data-from-file "$user_data")

hcloud server create --name "$name" --type "$type" --image "$SFP_IMAGE" \
  --location "$SFP_LOCATION" --ssh-key "$SFP_SSH_KEY_NAME" \
  "${labels[@]}" ${extra[@]+"${extra[@]}"} -o json > /dev/null

ip="$(sfp_ip "$name")"
# Hetzner reuses IP addresses; forget any earlier server that had this one.
ssh-keygen -R "$ip" -f "$SFP_ROOT/tools/cloud/.known_hosts" >/dev/null 2>&1 || true
for _ in $(seq 1 60); do
  if sfp_ssh "$ip" true 2>/dev/null; then
    echo "$ip"
    exit 0
  fi
  sleep 5
done
echo "server $name ($ip) did not answer SSH within 5 minutes; delete it with delete.sh $name" >&2
exit 1
