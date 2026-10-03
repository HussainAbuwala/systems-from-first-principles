#!/usr/bin/env bash
# Runs ON a fresh Ubuntu 24.04 server (copied there and executed by provision.sh).
#   base.sh ROLE     ROLE is "system" (runs the app) or "load" (runs k6)
# Installs pinned versions so every run uses the same software.
set -euo pipefail
role="$1"

NODE_VERSION=24.21.0
K6_VERSION=2.3.0
case "$(uname -m)" in
  x86_64)  node_arch=x64;   k6_arch=amd64 ;;
  aarch64) node_arch=arm64; k6_arch=arm64 ;;
  *) echo "unknown architecture $(uname -m)" >&2; exit 1 ;;
esac

mkdir -p /opt/sfp
export DEBIAN_FRONTEND=noninteractive

# Python is preinstalled on Ubuntu cloud images; the recorder needs nothing else.
if [[ "$role" == "system" ]]; then
  if ! node --version 2>/dev/null | grep -q "v$NODE_VERSION"; then
    curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$node_arch.tar.xz" \
      | tar -xJ -C /usr/local --strip-components=1
  fi
  # A self-made certificate, ECDSA P-256 like most real certificates today, so
  # the TLS handshake work matches a production site.
  if [[ ! -f /opt/sfp/tls/cert.pem ]]; then
    mkdir -p /opt/sfp/tls
    openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
      -keyout /opt/sfp/tls/key.pem -out /opt/sfp/tls/cert.pem -days 30 -subj "/CN=sfp-test" 2>/dev/null
  fi
  node --version
fi

if [[ "$role" == "load" ]]; then
  if ! k6 version 2>/dev/null | grep -q "v$K6_VERSION"; then
    curl -fsSL "https://github.com/grafana/k6/releases/download/v$K6_VERSION/k6-v$K6_VERSION-linux-$k6_arch.tar.gz" \
      | tar -xz -C /usr/local/bin --strip-components=1 "k6-v$K6_VERSION-linux-$k6_arch/k6"
  fi
  # A fresh connection per request leaves each closed connection in TIME_WAIT
  # for 60 s on the client. At thousands of connections a second the default
  # ~28,000 local ports run out, so the generator gets the full range and may
  # reuse ports safely. This tunes the measuring tool, not the system under test.
  cat > /etc/sysctl.d/90-sfp-load.conf <<'SYSCTL'
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
SYSCTL
  sysctl -q --system
  k6 version
fi

# Many simultaneous connections need many open files on both sides.
cat > /etc/security/limits.d/90-sfp.conf <<'LIMITS'
*    soft nofile 1048576
*    hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
LIMITS
