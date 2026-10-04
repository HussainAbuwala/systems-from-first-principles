# Shared settings for the Hetzner scripts. Sourced, not run.
set -euo pipefail

SFP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
set -a
# shellcheck disable=SC1091
. "$SFP_ROOT/.env"
set +a
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN missing from .env}"

SFP_EPISODE="${SFP_EPISODE:-url-shortener}"
SFP_LOCATION="${SFP_LOCATION:-nbg1}"  # moved from fsn1 at stage 3: CX33 is not offered in fsn1
SFP_IMAGE="${SFP_IMAGE:-ubuntu-24.04}"
SFP_SSH_KEY_NAME="sfp-laptop"
SFP_SSH_KEY_FILE="$HOME/.ssh/sfp_hetzner"
SFP_LEDGER="$SFP_ROOT/episodes/$SFP_EPISODE/results/spend-ledger.csv"
SFP_SELECTOR="series=sfp"

sfp_ssh() {
  local ip="$1"; shift
  ssh -i "$SFP_SSH_KEY_FILE" -o StrictHostKeyChecking=accept-new \
    -o UserKnownHostsFile="$SFP_ROOT/tools/cloud/.known_hosts" \
    -o ConnectTimeout=5 -o LogLevel=ERROR "root@$ip" "$@"
}

sfp_ip() {
  hcloud server describe "$1" -o json | jq -r '.public_net.ipv4.ip'
}

# Hourly and monthly net price (EUR) of a server type at our location.
sfp_price() {
  hcloud server-type describe "$1" -o json |
    jq -r --arg loc "$SFP_LOCATION" \
      '.prices[] | select(.location == $loc) | "\(.price_hourly.net) \(.price_monthly.net)"'
}

# Cost of a server that existed from $2 to $3 (epoch seconds). Hetzner bills
# per started hour, capped at the monthly price.
sfp_cost() {
  local type="$1" from="$2" to="$3" hourly monthly
  read -r hourly monthly < <(sfp_price "$type")
  python3 - "$from" "$to" "$hourly" "$monthly" <<'PY'
import math, sys
start, end, hourly, monthly = int(sys.argv[1]), int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
hours = max(1, math.ceil((end - start) / 3600))
print(hours, f"{min(hours * hourly, monthly):.4f}")
PY
}

sfp_ledger_init() {
  mkdir -p "$(dirname "$SFP_LEDGER")"
  [[ -f "$SFP_LEDGER" ]] || echo "server,type,role,created_utc,deleted_utc,hours_billed,eur,reason" > "$SFP_LEDGER"
}
