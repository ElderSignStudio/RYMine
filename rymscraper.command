#!/usr/bin/env bash
# RYMine local launcher. Double-click in Finder to run.
# (Right-click → Open the first time so macOS Gatekeeper lets it through.)

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PORT="${RYMSCRAPER_PORT:-3000}"
HOST="${RYMSCRAPER_HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}"
ORIGIN="${RYMSCRAPER_ORIGIN:-$URL}"

clear 2>/dev/null || true
cat <<'BANNER'
  ┌──────────────────────────┐
  │         RYMine           │
  └──────────────────────────┘
BANNER
echo

# Already running on this port? Just open the browser.
if lsof -ti:"$PORT" >/dev/null 2>&1; then
	echo "  Already running at $URL — opening browser."
	open "$URL"
	echo
	echo "  Close this window to dismiss."
	echo "  To stop the server, switch to the window where it's running"
	echo "  and press Ctrl+C, or run:  lsof -ti:$PORT | xargs kill"
	echo
	exit 0
fi

# First-run / missing production build
if [ ! -f "build/index.js" ]; then
	echo "  No production build found. Building (~1 second)…"
	npm run build --silent >/tmp/rymscraper-build.log 2>&1 || {
		echo "  Build failed. Last 20 lines of log:"
		tail -20 /tmp/rymscraper-build.log
		read -rp "  Press Enter to close…"
		exit 1
	}
	echo "  Build done."
	echo
fi

echo "  Starting at $URL"
echo "  (browser opens automatically · Ctrl+C in this window to stop)"
echo

# Open the browser shortly after the server boots
( sleep 1 && open "$URL" ) &

# Run the production server in the foreground so Ctrl+C cleanly stops it.
# ORIGIN is required so SvelteKit's CSRF check accepts same-origin form posts
# (otherwise adapter-node defaults to https in url.origin and blocks them).
exec env HOST="$HOST" PORT="$PORT" ORIGIN="$ORIGIN" node build
