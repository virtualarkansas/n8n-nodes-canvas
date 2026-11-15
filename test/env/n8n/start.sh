#!/usr/bin/env bash
# Start a throwaway n8n instance for the integration battery.
#   N8N_DIR   directory holding `node_modules/.bin/n8n` (npm i n8n@2.4.6)
#   N8N_HOME  n8n user folder (database, community nodes)
set -euo pipefail
: "${N8N_DIR:?set N8N_DIR to the directory where n8n is installed}"
: "${N8N_HOME:?set N8N_HOME to the n8n user folder}"

export N8N_USER_FOLDER="$N8N_HOME"
export N8N_PORT="${N8N_PORT:-5678}"
export N8N_HOST=localhost
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
export N8N_PROTOCOL=http
export WEBHOOK_URL="http://localhost:${N8N_PORT}/"
export N8N_ENCRYPTION_KEY="${N8N_ENCRYPTION_KEY:-n8n-nodes-canvas-test-key}"
export N8N_SECURE_COOKIE=false
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
export N8N_TEMPLATES_ENABLED=false
export N8N_PERSONALIZATION_ENABLED=false
export N8N_HIRING_BANNER_ENABLED=false
export N8N_LICENSE_AUTO_RENEW_ENABLED=false
export N8N_COMMUNITY_PACKAGES_ENABLED=true
export N8N_REINSTALL_MISSING_PACKAGES=false
export EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
export EXECUTIONS_DATA_SAVE_ON_ERROR=all
export EXECUTIONS_DATA_PRUNE=true
export EXECUTIONS_DATA_MAX_AGE=6
export GENERIC_TIMEZONE=UTC
export N8N_LOG_LEVEL="${N8N_LOG_LEVEL:-info}"

exec "$N8N_DIR/node_modules/.bin/n8n" start
