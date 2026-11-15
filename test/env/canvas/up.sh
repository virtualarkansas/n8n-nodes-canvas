#!/usr/bin/env bash
# Bring up a local Canvas LMS for the integration battery (Docker, host networking).
#
#   CANVAS_SRC   checkout of instructure/canvas-lms, branch `prod` (required for `build`)
#   EXTRA_CA_DIR optional directory containing `ca.crt` to trust during the image build
#
# Usage: up.sh build | start | stop | token | status
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="${CANVAS_IMAGE:-canvas-lms-n8n-test:prod}"
RUN_ARGS=(--network host --env-file "$HERE/canvas.env"
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
	docker run -d --name canvas-web "${RUN_ARGS[@]}" "$IMAGE" bundle exec rails server -b 127.0.0.1 -p 3000
	docker run -d --name canvas-jobs "${RUN_ARGS[@]}" "$IMAGE" bundle exec script/delayed_job run
	echo "waiting for Canvas on http://localhost:3000 ..."
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
status)
	docker ps --format '{{.Names}}\t{{.Status}}' | grep -E '^canvas-' || echo "no canvas containers running"
	;;
*)
	echo "usage: $0 build|start|stop|token|status" >&2
	exit 2
	;;
esac
