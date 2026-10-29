"""Check every source in config.toml and say which ones work.

    python3.13 scraper/check_sources.py           # test all sources
    python3.13 scraper/check_sources.py --email   # also send a test email with 3 real postings

For each source it prints whether it loaded, how many jobs it returned, and how many of those
are Canadian intern/co-op roles for current terms. Remove the ones marked BROKEN from config.toml.
"""
from __future__ import annotations

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scrape  # noqa: E402


def main() -> None:
    tasks = scrape.jobs()
    print(f"Checking {len(tasks)} sources…\n")
    broken, kept_rows = [], []

    def run(task):
        name, fn = task
        start = time.monotonic()
        try:
            return name, fn(), None, time.monotonic() - start
        except Exception as e:  # noqa: BLE001  (report everything, never crash)
            return name, None, e, time.monotonic() - start

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(run, tasks))

    for name, rows, err, took in results:
        if err is not None:
            broken.append(name)
            print(f"  BROKEN  {name:38} {type(err).__name__}: {str(err)[:90]}")
            continue
        keep = []
        for p in rows:
            if scrape.is_intern_title(p["title"]) and scrape.is_canada(p["locations"]):
                terms = scrape.current_terms(scrape.norm_terms(p["terms"]))
                if terms is not None:
                    p["terms"] = terms
                    keep.append(p)
        kept_rows += keep
        flag = "ok    " if rows else "EMPTY "
        print(f"  {flag}  {name:38} {len(rows):5} jobs, {len(keep):4} Canadian intern/co-op  ({took:.1f}s)")

    print(f"\n{len(tasks) - len(broken)}/{len(tasks)} sources work.")
    if broken:
        print("Remove or fix these in scraper/config.toml: " + ", ".join(broken))
    print("EMPTY just means no matching jobs right now (or a wrong slug that still answers). Keep those for now.")

    if "--email" in sys.argv:
        if not (os.getenv("EMAIL_TO") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD")):
            print("\nNo email settings found. Add EMAIL_TO, SMTP_USER and SMTP_PASSWORD to .env first.")
            return
        sample = [p for p in kept_rows if p["category"] in ("Software", "Data & ML", "Product")][:3] or kept_rows[:3]
        print(f"\nSending a test email with {len(sample)} postings to {os.getenv('EMAIL_TO')}…")
        scrape.send_email(sample)


if __name__ == "__main__":
    main()
