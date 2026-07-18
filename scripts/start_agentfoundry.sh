#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTSCOPE_DIR="${AGENTSCOPE_DIR:-$(cd "$ROOT_DIR/../agentscope" && pwd)}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_CONTAINER_NAME="${REDIS_CONTAINER_NAME:-agentfoundry-redis}"

PIDS=()
STARTED_REDIS_MODE=""

log() {
	printf '[agentfoundry] %s\n' "$*"
}

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

port_open() {
	nc -z "$1" "$2" >/dev/null 2>&1
}

wait_for_port() {
	local host="$1"
	local port="$2"
	local name="$3"
	local retries="${4:-60}"

	for _ in $(seq 1 "$retries"); do
		if port_open "$host" "$port"; then
			log "$name is ready at http://$host:$port"
			return 0
		fi
		sleep 1
	done

	log "$name did not become ready on $host:$port"
	return 1
}

cleanup() {
	local status=$?
	trap - EXIT INT TERM

	if [ "${#PIDS[@]}" -gt 0 ]; then
		log "stopping managed processes..."
		for pid in "${PIDS[@]}"; do
			if kill -0 "$pid" >/dev/null 2>&1; then
				kill "$pid" >/dev/null 2>&1 || true
			fi
		done
		for pid in "${PIDS[@]}"; do
			wait "$pid" >/dev/null 2>&1 || true
		done
	fi

	if [ "$STARTED_REDIS_MODE" = "docker" ] && command_exists docker; then
		docker rm -f "$REDIS_CONTAINER_NAME" >/dev/null 2>&1 || true
	fi

	exit "$status"
}

trap cleanup EXIT INT TERM

if ! command_exists nc; then
	log "missing nc; install netcat or adjust the script's port checks."
	exit 1
fi

if [ ! -f "$AGENTSCOPE_DIR/pyproject.toml" ]; then
	log "AgentScope runtime not found at $AGENTSCOPE_DIR"
	log "Set AGENTSCOPE_DIR to a local AgentScope checkout."
	exit 1
fi

if ! port_open "$REDIS_HOST" "$REDIS_PORT"; then
	if command_exists redis-server; then
		log "starting local Redis on $REDIS_HOST:$REDIS_PORT"
		mkdir -p "$ROOT_DIR/backend/data/redis"
		redis-server \
			--bind "$REDIS_HOST" \
			--port "$REDIS_PORT" \
			--dir "$ROOT_DIR/backend/data/redis" \
			--save "" \
			--appendonly no >/tmp/agentscope-enterprise-redis.log 2>&1 &
		PIDS+=("$!")
		STARTED_REDIS_MODE="process"
		wait_for_port "$REDIS_HOST" "$REDIS_PORT" "Redis"
	elif command_exists docker; then
		log "starting Redis container $REDIS_CONTAINER_NAME on $REDIS_HOST:$REDIS_PORT"
		docker rm -f "$REDIS_CONTAINER_NAME" >/dev/null 2>&1 || true
		docker run --rm -d \
			--name "$REDIS_CONTAINER_NAME" \
			-p "$REDIS_HOST:$REDIS_PORT:6379" \
			redis:7 >/dev/null
		STARTED_REDIS_MODE="docker"
		wait_for_port "$REDIS_HOST" "$REDIS_PORT" "Redis"
	else
		log "Redis is not running and neither redis-server nor docker is available."
		log "Start Redis manually, for example: docker run --rm -p 6379:6379 redis:7"
		exit 1
	fi
else
	log "using existing Redis at $REDIS_HOST:$REDIS_PORT"
fi

if ! command_exists uv; then
	log "missing uv; install uv before starting the AgentScope backend."
	exit 1
fi

if ! command_exists pnpm; then
	log "missing pnpm; install pnpm before starting the Web UI."
	exit 1
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
	log "installing frontend dependencies with pnpm"
	(cd "$ROOT_DIR/frontend" && pnpm install)
fi

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-$BACKEND_PORT}"
export UVICORN_RELOAD="${UVICORN_RELOAD:-0}"
export CORS_ALLOW_ORIGINS="${CORS_ALLOW_ORIGINS:-*}"
export REDIS_HOST
export REDIS_PORT
export ENTERPRISE_CONNECTOR="${ENTERPRISE_CONNECTOR:-mock}"
export ENTERPRISE_FIXTURE_PATH="${ENTERPRISE_FIXTURE_PATH:-$ROOT_DIR/backend/fixtures/tenant_data.local.json}"
export PYTHONPATH="$ROOT_DIR/backend${PYTHONPATH:+:$PYTHONPATH}"

if ! port_open 127.0.0.1 "$PORT"; then
	log "starting AgentFoundry backend on http://127.0.0.1:$PORT"
	(
		cd "$AGENTSCOPE_DIR"
		uv run --extra service --extra storage --extra rag \
			python "$ROOT_DIR/backend/main.py"
	) >/tmp/agentscope-enterprise-backend.log 2>&1 &
	PIDS+=("$!")
	wait_for_port 127.0.0.1 "$PORT" "Backend"
else
	log "using existing backend at http://127.0.0.1:$PORT"
fi

if ! port_open 127.0.0.1 "$FRONTEND_PORT"; then
	log "starting AgentFoundry frontend on http://127.0.0.1:$FRONTEND_PORT"
	(
		cd "$ROOT_DIR/frontend"
		pnpm exec vite --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort
	) >/tmp/agentscope-enterprise-frontend.log 2>&1 &
	PIDS+=("$!")
	wait_for_port 127.0.0.1 "$FRONTEND_PORT" "Frontend"
else
	log "using existing frontend at http://127.0.0.1:$FRONTEND_PORT"
fi

cat <<EOF

AgentFoundry is running.

Open:
  Frontend: http://127.0.0.1:$FRONTEND_PORT
  Backend:  http://127.0.0.1:$PORT
  API docs: http://127.0.0.1:$PORT/docs

Frontend setup:
  Server URL: http://127.0.0.1:$PORT
  Username:   acme:alice

Demo prompt:
  请查询 remote 政策、INC-1001 工单状态，并总结 engineering 部门指标。回答里说明信息来源。

Logs:
  Backend:  /tmp/agentscope-enterprise-backend.log
  Frontend: /tmp/agentscope-enterprise-frontend.log
  Redis:    /tmp/agentscope-enterprise-redis.log

Press Ctrl-C to stop the services started by this script.
EOF

if [ "${#PIDS[@]}" -eq 0 ]; then
	log "no managed processes were started; all services were already running."
	exit 0
fi

while true; do
	for pid in "${PIDS[@]}"; do
		if ! kill -0 "$pid" >/dev/null 2>&1; then
			wait "$pid" || true
			log "a managed process exited; stopping the rest."
			exit 1
		fi
	done
	sleep 2
done
