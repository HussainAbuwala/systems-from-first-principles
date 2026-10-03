#!/usr/bin/env bash
# Empty the database, fill it with N fake links, restart the service, and
# copy the sample of stored links back for the load generator and checker.
#   reset-and-seed.sh SERVER_NAME N SAMPLE_OUT [SAMPLE_SIZE]   (sample defaults to 100,000)
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

name="$1" n="$2" sample_out="$3" sample_size="${4:-100000}"
ip="$(sfp_ip "$name")"

sfp_ssh "$ip" "systemctl stop shortener && rm -f /var/lib/shortener/links.db* && \
  cd /opt/shortener && node --no-warnings seed.ts /var/lib/shortener/links.db $n /var/lib/shortener/sample.csv $sample_size && \
  systemctl start shortener && sleep 1 && systemctl is-active shortener && ls -lh /var/lib/shortener/links.db"
mkdir -p "$(dirname "$sample_out")"
scp -q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts" \
  "root@$ip:/var/lib/shortener/sample.csv" "$sample_out"
