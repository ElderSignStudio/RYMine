#!/bin/bash
# Wrapper invoked by launchd via com.rymine.local. Boots the production
# SvelteKit server. PATH is set in the plist's EnvironmentVariables block
# at install time (see svc), so node/npm/lsof are findable here without
# any per-run detection.

set -u

# WorkingDirectory in the plist already cd's us to the project root; this
# is a belt-and-suspenders cd against accidental launches from elsewhere.
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

# Fixed localhost-only port. Can be overridden in .env via RYMINE_PORT.
PORT="${RYMINE_PORT:-3000}"

# Load .env into our environment so RYMINE_GITHUB_TOKEN, RYMINE_PUBLISH_URL,
# RYMINE_DATA_PATH, etc. reach the running server. Same loading pattern as
# rymscraper.command so both launchers behave identically.
if [ -f .env ]; then
	set -a
	# shellcheck source=/dev/null
	. ./.env
	set +a
fi

# First-run convenience: if there's no production build yet, build now.
# Subsequent restarts skip this — code changes require `npm run build`
# explicitly (see docs/MACOS_LAUNCHAGENT.md).
if [ ! -f build/index.js ]; then
	echo "[$(date)] First-run: production bundle missing, running npm run build…"
	if ! npm run build --silent; then
		echo "[$(date)] build failed; check StandardErrorPath" >&2
		exit 1
	fi
	echo "[$(date)] build done."
fi

# Don't fight the interactive rymscraper.command launcher. If something
# else already holds the port (most commonly: the user double-clicked the
# .command launcher), exit cleanly so KeepAlive { SuccessfulExit = false }
# leaves us down instead of restart-thrashing.
if lsof -ti :"$PORT" >/dev/null 2>&1; then
	echo "[$(date)] Port $PORT already in use — LaunchAgent stepping aside."
	exit 0
fi

# Fixed localhost-only bind. ORIGIN is required for SvelteKit's CSRF check
# to accept same-origin form posts (otherwise adapter-node defaults to
# https in url.origin and blocks them).
export HOST=127.0.0.1
export PORT
export ORIGIN="http://127.0.0.1:$PORT"

echo "[$(date)] Starting RYMine on http://127.0.0.1:$PORT"
exec node build
