#!/usr/bin/env bash
# Install the current stage on a provisioned "system" server and (re)start it.
#   deploy.sh SERVER_NAME
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

name="$1"
ip="$(sfp_ip "$name")"
here="$(cd "$(dirname "$0")" && pwd)"
scp_opts=(-q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts")

sfp_ssh "$ip" "mkdir -p /opt/shortener /var/lib/shortener"
# Record exactly which code is deployed; runs copy this into their evidence.
version="$(git -C "$SFP_ROOT" describe --tags --always --dirty)"
sfp_ssh "$ip" "echo '$version' > /opt/shortener/VERSION"
scp "${scp_opts[@]}" "$here"/*.ts "root@$ip:/opt/shortener/"
scp "${scp_opts[@]}" "$here/shortener.service" "root@$ip:/etc/systemd/system/shortener.service"
# nginx in front (stage 2 onwards): Ubuntu's package, our site config, defaults otherwise.
sfp_ssh "$ip" "command -v nginx >/dev/null || (DEBIAN_FRONTEND=noninteractive apt-get -qq update && DEBIAN_FRONTEND=noninteractive apt-get -qq install -y nginx >/dev/null); rm -f /etc/nginx/sites-enabled/default"
scp "${scp_opts[@]}" "$here/nginx-shortener.conf" "root@$ip:/etc/nginx/conf.d/shortener.conf"
sfp_ssh "$ip" "cat > /etc/shortener.env <<ENV
DB_PATH=/var/lib/shortener/links.db
HOST=127.0.0.1
PORT=8080
PUBLIC_BASE=https://$ip
ENV
systemctl daemon-reload && systemctl enable --quiet shortener && systemctl restart shortener && \
nginx -t -q && systemctl reload-or-restart nginx && sleep 1 && systemctl is-active shortener nginx"
