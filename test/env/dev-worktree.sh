#!/usr/bin/env bash
# Give a git worktree of this repository its own n8n instance for the battery,
# so several people (or agents) can rebuild and restart n8n without disturbing
# each other. Canvas is shared; n8n is per worktree.
#
#   N8N_DIR    directory where n8n is installed (npm i n8n@2.4.6)        [required]
#   N8N_PORT   port for this worktree's n8n                             [required]
#   MAIN_REPO  checkout holding node_modules and the seeded test state  [default: /home/user/n8n-nodes-canvas]
#   INSTANCES  where n8n user folders are kept                          [default: $N8N_DIR/../instances]
#
# Usage (from anywhere, the script locates its own worktree):
#   dev-worktree.sh up       link node_modules, copy the Canvas state, build, start n8n, create credentials
#   dev-worktree.sh reload   rebuild the node, reinstall it and restart n8n (after every source change)
#   dev-worktree.sh sync     pull newer Canvas tokens/fixtures from the main checkout's state
#   dev-worktree.sh down     stop this worktree's n8n
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
: "${N8N_DIR:?set N8N_DIR}"
: "${N8N_PORT:?set N8N_PORT}"
MAIN_REPO="${MAIN_REPO:-/home/user/n8n-nodes-canvas}"
INSTANCES="${INSTANCES:-$(cd "$N8N_DIR/.." && pwd)/instances}"
export N8N_HOME="$INSTANCES/port-$N8N_PORT"
export N8N_DIR N8N_PORT
# Each instance needs its own task-runner broker port.
export N8N_RUNNERS_BROKER_PORT="$((N8N_PORT + 1000))"
mkdir -p "$N8N_HOME"

sync_state() {
	node -e '
		const fs = require("fs");
		const [mainPath, ownPath] = process.argv.slice(1);
		const main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
		const own = fs.existsSync(ownPath)
			? JSON.parse(fs.readFileSync(ownPath, "utf8"))
			: { n8n: { url: "", apiKey: "", credentials: {} }, canvas: {} };
		own.canvas = main.canvas;
		fs.writeFileSync(ownPath, JSON.stringify(own, null, 2) + "\n");
	' "$MAIN_REPO/test/.state.json" "$REPO/test/.state.json"
}

case "${1:-}" in
up)
	if [ "$REPO" != "$MAIN_REPO" ] && [ ! -e "$REPO/node_modules" ]; then
		ln -s "$MAIN_REPO/node_modules" "$REPO/node_modules"
	fi
	[ "$REPO" = "$MAIN_REPO" ] || sync_state
	"$HERE/n8n/reload.sh"
	(cd "$REPO" && N8N_URL="http://localhost:$N8N_PORT" npx tsx test/env/n8n/bootstrap.ts)
	;;
reload)
	"$HERE/n8n/reload.sh"
	;;
sync)
	sync_state
	(cd "$REPO" && N8N_URL="http://localhost:$N8N_PORT" npx tsx test/env/n8n/bootstrap.ts)
	;;
down)
	if [ -f "$N8N_HOME/n8n.pid" ]; then kill "$(cat "$N8N_HOME/n8n.pid")" 2>/dev/null || true; fi
	;;
*)
	echo "usage: $0 up|reload|sync|down" >&2
	exit 2
	;;
esac
