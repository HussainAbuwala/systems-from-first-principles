#!/usr/bin/env bash
# Rebuild the shortener on a new server after the old one is lost (E07, from
# stage 6). The new server gets the kept IP addresses, so every short link
# already handed out keeps working, and the Volume holding Litestream's copy;
# deploy.sh then restores the database from it. Prints how long each step took.
#
#   recover.sh [SERVER_NAME] [SAMPLE] [TYPE]
#   defaults: sfp-app, results/seed-10m/sample.csv, cx33
#
# If Hetzner has no TYPE available (e07-04: no CX33 anywhere in Europe), it
# asks again every minute for RETRY_MINUTES (default 20), then takes the first
# available of FALLBACK_TYPES (default: cpx32 cx43 cpx42, the closest x86
# types; deploy.sh installs the x86 Litestream package). The type used is
# printed; move back to TYPE later, once it is available, so tests keep
# running on the stage's own machine type.
#
# Expects the kept resources to be named after the server: SERVER_NAME-ipv4,
# SERVER_NAME-ipv6 (Primary IPs) and SERVER_NAME-copy (the Volume).
source "$(dirname "$0")/../../../tools/cloud/lib.sh"

here="$(cd "$(dirname "$0")" && pwd)"
name="${1:-sfp-app}"
sample="${2:-$here/../results/seed-10m/sample.csv}"
type="${3:-cx33}"

began=$(date +%s)
step() { echo "[$(( $(date +%s) - began )) s] $*"; }

# Only for a server that is really gone: a server that is just rebooting comes
# back by itself (E06), and rebuilding it would fight over its Volume.
if hcloud server describe "$name" >/dev/null 2>&1; then
  echo "$name still exists; recover.sh is only for a server that is gone" >&2
  exit 1
fi
for kept in "$name-ipv4" "$name-ipv6"; do
  assignee="$(hcloud primary-ip describe "$kept" -o json | jq -r '.assignee_id // empty')"
  [[ -z "$assignee" ]] || { echo "$kept is still assigned to server $assignee" >&2; exit 1; }
done
attached="$(hcloud volume describe "$name-copy" -o json | jq -r '.server // empty')"
[[ -z "$attached" ]] || { echo "$name-copy is still attached to server $attached" >&2; exit 1; }

retry_minutes="${RETRY_MINUTES:-20}"
fallback_types="${FALLBACK_TYPES:-cpx32 cx43 cpx42}"
create_err="$(mktemp)"
# Succeeds if the server was created; fails quietly only when Hetzner has no
# such type available, and stops the script on any other error.
create_as() {
  "$SFP_ROOT/tools/cloud/create.sh" "$name" "$1" system keep -- \
    --primary-ipv4 "$name-ipv4" --primary-ipv6 "$name-ipv6" --volume "$name-copy" > /dev/null 2> "$create_err" && return 0
  grep -q resource_unavailable "$create_err" || { cat "$create_err" >&2; exit 1; }
  return 1
}

step "creating $name ($type) with its kept addresses and the copy's Volume"
used=""
give_up=$(( $(date +%s) + retry_minutes * 60 ))
until create_as "$type"; do
  if (( $(date +%s) >= give_up )); then break; fi
  step "no $type available; asking again in 60 s (until $retry_minutes min have passed)"
  sleep 60
done
hcloud server describe "$name" >/dev/null 2>&1 && used="$type"
if [[ -z "$used" ]]; then
  for fallback in $fallback_types; do
    step "still no $type; trying $fallback"
    if create_as "$fallback"; then used="$fallback"; break; fi
  done
fi
[[ -n "$used" ]] || { echo "no server type available: $type $fallback_types" >&2; exit 1; }
step "created $name as $used$([[ "$used" != "$type" ]] && echo " (fallback: move back to $type when available)")"
step "installing base software"
"$SFP_ROOT/tools/provision/provision.sh" "$name" system
step "installing the shortener and restoring the database from the copy"
"$here/deploy.sh" "$name"

step "checking"
ip="$(sfp_ip "$name")"
status="$(curl -sk -o /dev/null -w '%{http_code}' "https://$ip/health")"
[[ "$status" == 200 ]] || { echo "/health answered $status" >&2; exit 1; }
# Seeded link N always points at story-N (the URL must match seed.ts). Check
# links the load generator never clicks (not in the sample), so no click count
# that a run checks is disturbed.
bad=0 checked=0
while IFS=, read -r code url; do
  checked=$((checked + 1))
  got="$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' "https://$ip/$code")"
  [[ "$got" == "301 $url" ]] || { echo "  $code: expected 301 $url, got $got" >&2; bad=$((bad + 1)); }
done < <(python3 - "$sample" <<'PY'
import csv, random, sys
ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
def decode(code):
    n = 0
    for ch in code:
        n = n * 62 + ALPHABET.index(ch)
    return n
def encode(n):
    code = ""
    while n > 0:
        code = ALPHABET[n % 62] + code
        n //= 62
    return code
sampled = {decode(row["code"]) for row in csv.DictReader(open(sys.argv[1]))}
top = max(sampled)  # every link up to here was seeded
picked = set()
while len(picked) < min(20, top - len(sampled)):
    i = random.randint(1, top)
    if i not in sampled:
        picked.add(i)
for i in sorted(picked):
    print(f"{encode(i)},https://news.example.invalid/articles/2026/10/story-{i}?utm_source=share&utm_medium=link&ref=sfp-seed")
PY
)
[[ "$bad" == 0 ]] || { echo "$bad checked links wrong" >&2; exit 1; }
step "done: /health and $checked seeded links answer correctly on https://$ip"
