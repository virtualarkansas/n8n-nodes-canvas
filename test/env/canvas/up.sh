#!/usr/bin/env bash
# Bring up a local Canvas LMS for the integration battery (Docker, host networking).
#
#   CANVAS_SRC   checkout of instructure/canvas-lms, branch `prod` (required for `build`)
#   EXTRA_CA_DIR optional directory containing `ca.crt` to trust during the image build
#
#   CANVAS_WEB_WORKERS  web server processes (default 3; each needs about 1.5 GB)
#
# Usage: up.sh build | start | stop | restart-web | token | trim-logs | status
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="${CANVAS_IMAGE:-canvas-lms-n8n-test:prod}"
# Canvas logs every request and SQL statement; cap the container logs so they cannot fill the disk.
RUN_ARGS=(--network host --env-file "$HERE/canvas.env" --log-opt max-size=50m --log-opt max-file=2
	-v canvas_files:/usr/src/app/tmp/files
	-v "$HERE/config/domain.yml:/usr/src/app/config/domain.yml:ro"
	-v "$HERE/config/outgoing_mail.yml:/usr/src/app/config/outgoing_mail.yml:ro")

case "${1:-}" in
build)
	: "${CANVAS_SRC:?set CANVAS_SRC to a canvas-lms checkout (branch prod)}"
	extra="${EXTRA_CA_DIR:-$(mktemp -d)}"
	docker build --network host \
		${HTTPS_PROXY:+--build-arg "https_proxy=$HTTPS_PROXY" --build-arg "HTTPS_PROXY=$HTTPS_PROXY"} \
		--build-context "extra=$extra" -f "$HERE/Dockerfile" -t "$IMAGE" "$CANVAS_SRC"
	;;
start)
	docker inspect canvas-pg >/dev/null 2>&1 || docker run -d --name canvas-pg --network host \
		-e POSTGRES_PASSWORD=sekret -v canvas_pg_data:/var/lib/postgresql/data pgvector/pgvector:pg14 \
		-c max_locks_per_transaction=640 -c shared_buffers=512MB \
		-c fsync=off -c synchronous_commit=off -c full_page_writes=off
	docker inspect canvas-redis >/dev/null 2>&1 || docker run -d --name canvas-redis --network host redis:alpine
	docker start canvas-pg canvas-redis >/dev/null
	until docker exec canvas-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	if ! docker exec canvas-pg psql -U postgres -lqt | cut -d'|' -f1 | grep -qw canvas_development; then
		docker run --rm "${RUN_ARGS[@]}" "$IMAGE" \
			bash -c 'bundle exec rake db:create && bundle exec rake db:initial_setup'
	fi
	docker rm -f canvas-web canvas-jobs >/dev/null 2>&1 || true
	# Canvas' config/puma.rb allows one thread, so one process serves one request at a time.
	# Several worker processes let parallel test files (and the node's batches) make progress.
	docker run -d --name canvas-web "${RUN_ARGS[@]}" "$IMAGE" \
		bundle exec puma -C config/puma.rb -b tcp://127.0.0.1:3000 -w "${CANVAS_WEB_WORKERS:-3}"
	docker run -d --name canvas-jobs "${RUN_ARGS[@]}" "$IMAGE" bundle exec script/delayed_job run
	echo "waiting for Canvas on http://localhost:3000 ..."
	until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:3000/api/v1/accounts)" = "401" ]; do sleep 3; done
	echo "Canvas is up."
	;;
restart-web)
	# Only the web server: database, Redis and the job runner keep running.
	docker rm -f canvas-web >/dev/null 2>&1 || true
	docker run -d --name canvas-web "${RUN_ARGS[@]}" "$IMAGE" \
		bundle exec puma -C config/puma.rb -b tcp://127.0.0.1:3000 -w "${CANVAS_WEB_WORKERS:-3}"
	until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:3000/api/v1/accounts)" = "401" ]; do sleep 3; done
	echo "Canvas is up."
	;;
stop)
	docker rm -f canvas-web canvas-jobs >/dev/null 2>&1 || true
	docker stop canvas-pg canvas-redis >/dev/null 2>&1 || true
	;;
token)
	# Print a fresh admin API token.
	docker exec canvas-web bundle exec rails runner '
		u = Pseudonym.where(unique_id: ENV.fetch("CANVAS_LMS_ADMIN_EMAIL")).first.user
		puts "TOKEN=#{u.access_tokens.create!(purpose: "n8n battery admin").full_token}"' 2>/dev/null | grep '^TOKEN=' | cut -d= -f2
	;;
trim-logs)
	# The Rails log inside the containers is not rotated; empty it (safe while Canvas runs).
	for c in canvas-web canvas-jobs; do
		docker exec "$c" sh -c 'for f in log/*.log; do : > "$f"; done' 2>/dev/null || true
	done
	;;
status)
	docker ps --format '{{.Names}}\t{{.Status}}' | grep -E '^canvas-' || echo "no canvas containers running"
	;;
*)
	echo "usage: $0 build|start|stop|token|trim-logs|status" >&2
	exit 2
	;;
esac
