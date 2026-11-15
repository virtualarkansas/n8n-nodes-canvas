#!/usr/bin/env bash
# Rebuild the node package, install it into the n8n community-nodes folder the way the
# README tells users to (npm install of the packed tarball), and restart n8n.
#   N8N_DIR, N8N_HOME as for start.sh.  SKIP_BUILD=1 to reuse the current dist/.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
: "${N8N_DIR:?set N8N_DIR}"
: "${N8N_HOME:?set N8N_HOME}"
PORT="${N8N_PORT:-5678}"

cd "$REPO"
if [ -z "${SKIP_BUILD:-}" ]; then npm run build >/dev/null; fi
TGZ="$(npm pack --silent --pack-destination "$N8N_HOME" | tail -1)"
mkdir -p "$N8N_HOME/.n8n/nodes"
cd "$N8N_HOME/.n8n/nodes"
[ -f package.json ] || echo '{"name":"installed-nodes","private":true,"dependencies":{}}' > package.json
npm install "$N8N_HOME/$TGZ" --no-audit --no-fund --silent

if [ -f "$N8N_HOME/n8n.pid" ] && kill -0 "$(cat "$N8N_HOME/n8n.pid")" 2>/dev/null; then
	kill "$(cat "$N8N_HOME/n8n.pid")"
	while kill -0 "$(cat "$N8N_HOME/n8n.pid")" 2>/dev/null; do sleep 0.3; done
fi
nohup "$HERE/start.sh" > "$N8N_HOME/n8n.log" 2>&1 &
echo $! > "$N8N_HOME/n8n.pid"
# /healthz answers before the public API is mounted; wait for the API itself (401 without a key).
until [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/v1/workflows")" = "401" ]; do sleep 0.5; done
echo "n8n restarted with $TGZ"
