"""Run the scraper on a loop from your own computer.

    python3 scraper/watch.py              # every 5 minutes, until you stop it (Ctrl+C)
    python3 scraper/watch.py --every 10   # every 10 minutes
    python3 scraper/watch.py --once       # one run, then exit (handy for testing)

Writes public/data/postings.local.json (git-ignored), which `npm run dev` shows instead of the
committed file. A failed run is logged and the loop keeps going.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCAL_OUT = ROOT / "public" / "data" / "postings.local.json"


def log(msg: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def run_once() -> None:
    # NB_LOCAL turns macOS banners on by default; set NB_NOTIFY=0 in .env to turn them off
    env = {**os.environ, "NB_OUT": str(LOCAL_OUT), "NB_LOCAL": "1"}
    started = time.monotonic()
    try:
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scraper" / "scrape.py")],
            env=env, capture_output=True, text=True, timeout=240,
        )
    except subprocess.TimeoutExpired:
        log("Run took over 4 minutes and was stopped. Next run continues as normal.")
        return
    took = time.monotonic() - started
    lines = [l for l in (proc.stdout + proc.stderr).splitlines() if l.strip()]
    summary = lines[0] if lines else "no output"
    log(f"{summary} ({took:.0f}s)")
    for line in lines[1:]:
        print(f"    {line}", flush=True)
    if proc.returncode:
        log(f"Scraper exited with code {proc.returncode}. Will try again next round.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape postings on a loop")
    ap.add_argument("--every", type=float, default=5, help="minutes between runs (default 5)")
    ap.add_argument("--once", action="store_true", help="run once and exit")
    args = ap.parse_args()

    if args.once:
        run_once()
        return

    interval = max(1.0, args.every) * 60
    log(f"Watching every {args.every:g} minutes. Ctrl+C to stop.")
    while True:
        start = time.monotonic()
        run_once()
        # Sleep the remainder so runs stay on a steady cadence
        time.sleep(max(5.0, interval - (time.monotonic() - start)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Stopped.")
