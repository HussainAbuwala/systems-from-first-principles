#!/usr/bin/env bash
# Install (or remove with --remove) a launchd job that runs watchdog.sh every
# 15 minutes while this Mac is awake. Output goes to tools/cloud/watchdog.log.
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
plist="$HOME/Library/LaunchAgents/com.sfp.watchdog.plist"

launchctl bootout "gui/$(id -u)" "$plist" 2>/dev/null || true
if [[ "${1:-}" == "--remove" ]]; then
  rm -f "$plist"
  echo "watchdog removed"
  exit 0
fi

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.sfp.watchdog</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$dir/watchdog.sh</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$dir/watchdog.log</string>
  <key>StandardErrorPath</key><string>$dir/watchdog.log</string>
</dict>
</plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "watchdog installed: runs every 15 minutes, log at $dir/watchdog.log"
