#!/bin/bash
# Double-click me in Finder. Starts the 5-minute scraper and the local site at http://localhost:3000.
# Close this window (or press Ctrl+C) to stop both.
cd "$(dirname "$0")" || exit 1
say() { printf "\n\033[1m%s\033[0m\n" "$1"; }
fail() { printf "\n\033[31m%s\033[0m\n" "$1"; read -r -p "Press Return to close."; exit 1; }

# --- Python 3.11+ (the scraper uses tomllib)
PY=""
for c in python3.13 python3.12 python3.11 \
         /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 \
         /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 \
         /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 \
         /opt/homebrew/bin/python3 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 11))' 2>/dev/null; then
    PY="$(command -v "$c")"; break
  fi
done
[ -n "$PY" ] || fail "Couldn't find Python 3.11 or newer. Install it from python.org, then double-click this again."
say "Python: $PY ($("$PY" --version 2>&1))"

# --- HTTPS certificates (python.org builds ship without them)
if ! "$PY" -c 'import urllib.request; urllib.request.urlopen("https://raw.githubusercontent.com", timeout=10)' >/dev/null 2>&1; then
  if ! "$PY" -c 'import certifi' >/dev/null 2>&1; then
    say "Installing certificates for Python…"
    "$PY" -m pip install --user --quiet certifi 2>/dev/null || "$PY" -m pip install --user --quiet --break-system-packages certifi
  fi
fi

# --- Node (loads nvm if node isn't on PATH)
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
command -v npm >/dev/null 2>&1 || fail "Couldn't find Node.js. Install Node 20+ from nodejs.org, then double-click this again."
say "Node: $(node -v)"

if [ ! -d node_modules/next ]; then
  say "Installing site packages (first run only, about a minute)…"
  npm install --no-audit --no-fund || fail "npm install failed. The error is above."
fi

# --- Scraper loop in the background, site in the foreground
mkdir -p scraper/.cache
say "Starting the 5-minute scraper (log: scraper/.cache/watch.log)…"
"$PY" -u scraper/watch.py --every 5 >> scraper/.cache/watch.log 2>&1 &
WATCH_PID=$!
trap 'kill $WATCH_PID 2>/dev/null; echo; echo "Stopped scraper and site."' EXIT

# Wait for the first scrape so the site has fresh data
for _ in $(seq 1 60); do
  [ -f public/data/postings.local.json ] && break
  kill -0 $WATCH_PID 2>/dev/null || fail "The scraper stopped. Last lines of its log:
$(tail -15 scraper/.cache/watch.log)"
  sleep 1
done
tail -4 scraper/.cache/watch.log

say "Opening http://localhost:3000 …"
( sleep 6; open "http://localhost:3000" ) &
npm run dev
