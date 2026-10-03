#!/usr/bin/env bash
# Delete any of our servers past its delete-after time. Run every 15 minutes
# by launchd (see install-watchdog.sh). Servers labelled keep=true are skipped.
source "$(dirname "$0")/lib.sh"

now=$(date +%s)
hcloud server list -l "$SFP_SELECTOR,!keep" -o json |
  jq -r '.[] | "\(.name) \(.labels["delete-after"] // "0")"' |
  while read -r name deadline; do
    if (( now > deadline )); then
      echo "$(date -u +%FT%TZ) watchdog deleting $name (deadline $(date -u -r "$deadline" +%FT%TZ))"
      "$(dirname "$0")/delete.sh" "$name" watchdog
    fi
  done
