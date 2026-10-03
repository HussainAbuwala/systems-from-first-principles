#!/usr/bin/env bash
# Install the current stage on a provisioned "system" server and (re)start it.
#   deploy.sh SERVER_NAME
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

name="$1"
ip="$(sfp_ip "$name")"
here="$(cd "$(dirname "$0")" && pwd)"
scp_opts=(-q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts")

sfp_ssh "$ip" "mkdir -p /opt/shortener /var/lib/shortener"
scp "${scp_opts[@]}" "$here"/*.ts "root@$ip:/opt/shortener/"
scp "${scp_opts[@]}" "$here/shortener.service" "root@$ip:/etc/systemd/system/shortener.service"
sfp_ssh "$ip" "cat > /etc/shortener.env <<ENV
DB_PATH=/var/lib/shortener/links.db
TLS_DIR=/opt/sfp/tls
PUBLIC_BASE=https://$ip
ENV
systemctl daemon-reload && systemctl enable --quiet shortener && systemctl restart shortener && sleep 1 && systemctl is-active shortener"
