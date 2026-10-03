#!/usr/bin/env bash
# Install pinned software on a server and copy the shared tools to /opt/sfp.
#   provision.sh SERVER_NAME ROLE      ROLE: system | load
source "$(dirname "$0")/../cloud/lib.sh"

name="$1" role="$2"
ip="$(sfp_ip "$name")"
here="$SFP_ROOT/tools"

sfp_ssh "$ip" "mkdir -p /opt/sfp"
scp -q -i "$SFP_SSH_KEY_FILE" -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts" \
  "$here/provision/base.sh" "$here/recorder/recorder.py" "$here/okserver/ok.mjs" "root@$ip:/opt/sfp/"
sfp_ssh "$ip" "bash /opt/sfp/base.sh $role"
