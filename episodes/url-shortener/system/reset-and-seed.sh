#!/usr/bin/env bash
# Empty the database (and, from stage 6, its copy), fill it with N fake links,
# restart the services, and copy the sample of stored links back for the load
# generator and checker.
#   reset-and-seed.sh SERVER_NAME N SAMPLE_OUT [SAMPLE_SIZE]   (sample defaults to 100,000)
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

name="$1" n="$2" sample_out="$3" sample_size="${4:-100000}"
ip="$(sfp_ip "$name")"

# Stage 6: the copy on the Volume must start again with the new database, so
# Litestream is stopped and its copy and bookkeeping removed too.
sfp_ssh "$ip" "mountpoint -q /mnt/copy && systemctl stop litestream shortener && \
  rm -rf /var/lib/shortener/links.db* /var/lib/shortener/.links.db-litestream /mnt/copy/links && \
  cd /opt/shortener && node --no-warnings seed.ts /var/lib/shortener/links.db $n /var/lib/shortener/sample.csv $sample_size && \
  systemctl start shortener && sleep 1 && systemctl start litestream && systemctl is-active shortener litestream && \
  ls -lh /var/lib/shortener/links.db"
mkdir -p "$(dirname "$sample_out")"
scp -q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts" \
  "root@$ip:/var/lib/shortener/sample.csv" "$sample_out"
