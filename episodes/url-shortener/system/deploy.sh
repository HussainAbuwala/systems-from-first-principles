#!/usr/bin/env bash
# Install the current stage on a provisioned "system" server and (re)start it.
# From stage 6 the server needs one attached Volume for the copy; on a new
# server with no database, the database is first restored from that copy, and
# (stage 7) the link counter jumps a million ahead.
#   deploy.sh SERVER_NAME
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

name="$1"
ip="$(sfp_ip "$name")"
here="$(cd "$(dirname "$0")" && pwd)"
scp_opts=(-q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts")

sfp_ssh "$ip" "mkdir -p /opt/shortener /var/lib/shortener"
# Record exactly which code is deployed; runs copy this into their evidence.
# Only code counts as "dirty": results files (the spend ledger, samples) change
# during runs, including while recover.sh deploys mid-run (E07).
version="$(git -C "$SFP_ROOT" describe --tags --always)"
git -C "$SFP_ROOT" diff --quiet HEAD -- . ':(exclude,glob)episodes/*/results/**' || version="$version-dirty"
sfp_ssh "$ip" "echo '$version' > /opt/shortener/VERSION"
scp "${scp_opts[@]}" "$here"/*.ts "root@$ip:/opt/shortener/"
scp "${scp_opts[@]}" "$here/shortener.service" "root@$ip:/etc/systemd/system/shortener.service"
# nginx in front (stage 2 onwards): Ubuntu's package, our site config, defaults otherwise.
sfp_ssh "$ip" "command -v nginx >/dev/null || (DEBIAN_FRONTEND=noninteractive apt-get -qq update && DEBIAN_FRONTEND=noninteractive apt-get -qq install -y nginx >/dev/null); rm -f /etc/nginx/sites-enabled/default"
scp "${scp_opts[@]}" "$here/nginx-shortener.conf" "root@$ip:/etc/nginx/conf.d/shortener.conf"
# Stage 6: the copy lives on the server's one attached Volume, mounted at /mnt/copy.
server_id="$(hcloud server describe "$name" -o json | jq -r '.id')"
devices="$(hcloud volume list -o json | jq -r --argjson s "$server_id" '.[] | select(.server == $s) | .linux_device')"
if [[ "$(grep -c . <<<"$devices")" != 1 ]]; then
  echo "expected exactly one Volume attached to $name, found: ${devices:-none}" >&2
  exit 1
fi
sfp_ssh "$ip" "mkdir -p /mnt/copy && \
  (grep -q ' /mnt/copy ' /etc/fstab || echo '$devices /mnt/copy ext4 discard,nofail,defaults 0 0' >> /etc/fstab) && \
  systemctl daemon-reload && mount -a && mountpoint -q /mnt/copy"
# Litestream, pinned, from the project's own release.
ls_version=0.5.17
ls_sha256=a191a0928884d1820fab1f866ede1d0d5811c323d0587bf863a43481a82a7668
sfp_ssh "$ip" "[ \"\$(dpkg-query -W -f='\${Version}' litestream 2>/dev/null)\" = $ls_version ] || { \
  curl -fsSL -o /tmp/litestream.deb https://github.com/benbjohnson/litestream/releases/download/v$ls_version/litestream-$ls_version-linux-x86_64.deb && \
  echo '$ls_sha256  /tmp/litestream.deb' | sha256sum -c --quiet && dpkg -i /tmp/litestream.deb >/dev/null; }"
scp "${scp_opts[@]}" "$here/litestream.yml" "root@$ip:/etc/litestream.yml"
# Never copy into the server's own disk if the Volume is missing.
sfp_ssh "$ip" "mkdir -p /etc/systemd/system/litestream.service.d && printf '[Unit]\nRequiresMountsFor=/mnt/copy\n' > /etc/systemd/system/litestream.service.d/volume.conf"
# Settings, including the operator secret for takedowns (stage 8, from .env),
# sent over SSH's input so the secret never appears in a command line; the file
# is readable by root only.
sfp_ssh "$ip" "umask 077 && cat > /etc/shortener.env && systemctl daemon-reload" <<ENV
DB_PATH=/var/lib/shortener/links.db
HOST=127.0.0.1
PORT=8080
PUBLIC_BASE=https://$ip
TAKEDOWN_SECRET=${TAKEDOWN_SECRET:?TAKEDOWN_SECRET missing from .env}
ENV
# Does nothing unless the database is missing and the Volume holds a copy.
# After a real restore (stage 7), jump the counter before the app starts, so no
# link lost with the old machine has its code issued again (jump.ts).
restore_start=$(date +%s)
restored="$(sfp_ssh "$ip" "if [ -e /var/lib/shortener/links.db ]; then echo existing; else \
  litestream restore -if-replica-exists /var/lib/shortener/links.db >&2 && \
  { [ -e /var/lib/shortener/links.db ] && echo restored || echo new; }; fi")"
echo "restore step: $(( $(date +%s) - restore_start )) s ($restored database)"
if [[ "$restored" == restored ]]; then
  sfp_ssh "$ip" "cd /opt/shortener && node --no-warnings jump.ts /var/lib/shortener/links.db"
fi
sfp_ssh "$ip" "systemctl enable --quiet shortener && systemctl restart shortener && \
systemctl enable --quiet litestream && systemctl restart litestream && \
nginx -t -q && systemctl reload-or-restart nginx && sleep 1 && systemctl is-active shortener litestream nginx"
