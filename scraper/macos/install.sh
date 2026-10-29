#!/bin/bash
# Starts the 5-minute scraper in the background on your Mac, and again every time you log in.
#   ./scraper/macos/install.sh            install (or reinstall) and start
#   ./scraper/macos/install.sh uninstall  stop it and remove the login item
set -euo pipefail

LABEL="com.northbound.watch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$REPO/scraper/.cache/watch.log"

if [[ "${1:-}" == "uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Stopped and removed. The scraper won't start at login anymore."
  exit 0
fi

case "$REPO" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*)
    echo "macOS blocks background jobs from reading Desktop, Documents and Downloads, so this would fail silently." >&2
    echo "Move the repo somewhere like ~/code first:" >&2
    echo "  mkdir -p ~/code && mv \"$REPO\" ~/code/ && cd ~/code/northbound && ./scraper/macos/install.sh" >&2
    exit 1
    ;;
esac

PY="$(command -v python3 || true)"
if [[ -z "$PY" ]]; then
  echo "python3 not found. Install Python 3.11+ from python.org first." >&2
  exit 1
fi
if ! "$PY" -c 'import sys; assert sys.version_info >= (3, 11)' 2>/dev/null; then
  echo "$PY is older than Python 3.11 (needed for tomllib). Install a newer Python from python.org." >&2
  exit 1
fi

# Fail now, loudly, instead of silently in the background
if ! "$PY" -c 'import ssl, urllib.request; urllib.request.urlopen("https://raw.githubusercontent.com", timeout=10)' 2>/dev/null; then
  if ! "$PY" -c 'import certifi' 2>/dev/null; then
    echo "Python can't verify HTTPS certificates yet. Fix it with ONE of these, then rerun this script:" >&2
    echo "  open \"/Applications/Python $("$PY" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')/Install Certificates.command\"" >&2
    echo "  $PY -m pip install --user certifi" >&2
    exit 1
  fi
fi

mkdir -p "$REPO/scraper/.cache" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PY</string>
    <string>-u</string>
    <string>$REPO/scraper/watch.py</string>
    <string>--every</string>
    <string>5</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Running. It scrapes every 5 minutes and starts again whenever you log in."
echo "Watch it live:   tail -f \"$LOG\""
echo "Stop it:         ./scraper/macos/install.sh uninstall"
