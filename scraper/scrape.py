"""northbound scraper.

Pulls internship / co-op postings from community GitHub lists and company ATS boards,
keeps the Canadian ones, merges them with the previous run (so "first seen" dates stick),
writes public/data/postings.json, and texts you about new ones.

Standard library only. Run:  python scraper/scrape.py
Env (all optional):
  TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, ALERT_TO   -> SMS alerts
  DISCORD_WEBHOOK_URL                               -> Discord alerts
  DRY_RUN=1                                         -> print alerts instead of sending
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = tomllib.loads((ROOT / "scraper" / "config.toml").read_text())
OUT = ROOT / "public" / "data" / "postings.json"
# "Today" means today where you live, not in UTC (set TZ in the workflow if you move)
LOCAL = ZoneInfo(os.getenv("NB_TZ", "America/Vancouver"))
NOW = datetime.now(LOCAL)
UA = {"User-Agent": "northbound-scraper/1.0 (personal job tracker)"}

# ---------------------------------------------------------------- helpers

PROVINCES = r"(ON|BC|QC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)"
CANADA_RE = re.compile(
    r"\bcanada\b|\bcanadian\b|,\s*" + PROVINCES + r"\b|\b(ontario|british columbia|quebec|québec|alberta|"
    r"manitoba|saskatchewan|nova scotia|new brunswick|newfoundland)\b|\b(toronto|vancouver|montreal|montréal|"
    r"ottawa|waterloo|kitchener|calgary|edmonton|burnaby|richmond, bc|surrey, bc|markham|mississauga|"
    r"halifax|winnipeg|victoria, bc|quebec city|gatineau|oakville|vaughan|brampton|london, on|hamilton, on)\b",
    re.IGNORECASE,
)


def is_canada(locations: list[str]) -> bool:
    return any(CANADA_RE.search(loc or "") for loc in locations)


def _words(s: str) -> str:
    return " " + re.sub(r"[^a-z0-9]+", " ", s.lower()) + " "


INCLUDE = [_words(w) for w in CONFIG["filters"]["title_include"]]
EXCLUDE = [_words(w) for w in CONFIG["filters"]["title_exclude"]]


def is_intern_title(title: str) -> bool:
    t = _words(title)
    return any(w in t for w in INCLUDE) and not any(w in t for w in EXCLUDE)


HINTS = {"quant": "Quant", "hardware": "Hardware", "product": "Product", "software": "Software",
         "ai/ml/data": "Data & ML", "data science": "Data & ML"}


def categorize(title: str, hint: str | None = None) -> str:
    h = (hint or "").lower()
    for key, cat in HINTS.items():
        if h.startswith(key):
            return cat
    h = ""
    t = title.lower()
    if "quant" in h or re.search(r"\bquant|trading|trader\b", t):
        return "Quant"
    if "hardware" in h or re.search(r"hardware|electrical|mechanical|firmware|embedded|asic|fpga|circuit|rf\b", t):
        return "Hardware"
    if "data" in h or "ai" in h.split() or re.search(r"\bdata\b|machine learning|\bml\b|\bai\b|analytics|scien", t):
        return "Data & ML"
    if "product" in h or re.search(r"product manag|\bpm\b|program manag|business analyst|product analyst", t):
        return "Product"
    if "software" in h or re.search(r"software|developer|engineer|devops|security|cloud|full.?stack|backend|"
                                     r"frontend|mobile|web|qa|test|sre|platform|it\b", t):
        return "Software"
    return "Other"


TERM_RE = re.compile(r"\b(winter|spring|summer|fall|autumn)\s*(20\d\d)\b", re.I)


def terms_from(text: str) -> list[str]:
    seen = []
    for season, year in TERM_RE.findall(text or ""):
        s = "Fall" if season.lower() == "autumn" else season.capitalize()
        val = f"{s} {year}"
        if val not in seen:
            seen.append(val)
    return seen


def pid(url: str) -> str:
    clean = re.sub(r"[?#].*$", "", url.strip().lower()).rstrip("/")
    return hashlib.sha1(clean.encode()).hexdigest()[:12]


def get_json(url: str, *, data: dict | None = None, timeout: int = 25):
    body = json.dumps(data).encode() if data is not None else None
    headers = dict(UA)
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def iso(ts) -> str | None:
    """Accepts epoch seconds/ms or an ISO string."""
    if ts is None or ts == "":
        return None
    try:
        if isinstance(ts, (int, float)):
            if ts > 10_000_000_000:
                ts = ts / 1000
            return datetime.fromtimestamp(ts, tz=LOCAL).date().isoformat()
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone(LOCAL).date().isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def posting(company, title, locations, url, source, posted=None, terms=None, category_hint=None):
    locations = [l.strip() for l in locations if l and l.strip()]
    return {
        "id": pid(url),
        "company": company.strip(),
        "title": re.sub(r"\s+", " ", title).strip(),
        "locations": locations,
        "url": url,
        "source": source,
        "category": categorize(title, category_hint),
        "terms": terms or terms_from(title),
        "posted": posted,
    }


# ---------------------------------------------------------------- sources

def from_github_list(entry: dict) -> list[dict]:
    rows = get_json(entry["url"], timeout=60)
    out = []
    for x in rows:
        if not x.get("active") or not x.get("is_visible", True):
            continue
        locs = x.get("locations") or []
        if not is_canada(locs):
            continue
        terms = [t for t in (x.get("terms") or []) if t and t != "N/A"]
        out.append(posting(x["company_name"], x["title"], locs, x["url"], entry["name"],
                           iso(x.get("date_posted")), terms or None, x.get("category")))
    return out


def from_greenhouse(slug: str) -> list[dict]:
    data = get_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs")
    company = slug.replace("-", " ").title()
    out = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        out.append(posting(company, j["title"], [loc], j["absolute_url"], "Greenhouse",
                           iso(j.get("first_published") or j.get("updated_at"))))
    return out


def from_lever(slug: str) -> list[dict]:
    data = get_json(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    out = []
    for j in data:
        cats = j.get("categories") or {}
        locs = cats.get("allLocations") or [cats.get("location", "")]
        out.append(posting(slug.title(), j["text"], locs, j["hostedUrl"], "Lever", iso(j.get("createdAt"))))
    return out


def from_ashby(slug: str) -> list[dict]:
    data = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    out = []
    for j in data.get("jobs", []):
        locs = [j.get("location", "")] + [s.get("location", "") for s in j.get("secondaryLocations") or []]
        out.append(posting(slug.title(), j["title"], locs, j["jobUrl"], "Ashby", iso(j.get("publishedAt"))))
    return out


def from_smartrecruiters(company_id: str) -> list[dict]:
    q = urllib.parse.urlencode({"q": "intern", "country": "ca", "limit": 100})
    data = get_json(f"https://api.smartrecruiters.com/v1/companies/{company_id}/postings?{q}")
    out = []
    for j in data.get("content", []):
        l = j.get("location") or {}
        loc = ", ".join(p for p in [l.get("city"), l.get("region"), l.get("country", "").upper()] if p)
        if l.get("country", "").lower() == "ca":
            loc += ", Canada"
        name = (j.get("company") or {}).get("name") or company_id
        url = f"https://jobs.smartrecruiters.com/{company_id}/{j['id']}"
        out.append(posting(name, j["name"], [loc], url, "SmartRecruiters", iso(j.get("releasedDate"))))
    return out


def workday_posted(text: str) -> str | None:
    t = (text or "").lower()
    if "today" in t:
        return NOW.date().isoformat()
    if "yesterday" in t:
        return (NOW - timedelta(days=1)).date().isoformat()
    m = re.search(r"(\d+)\+?\s*days?", t)
    if m:
        return (NOW - timedelta(days=int(m.group(1)))).date().isoformat()
    return None


def from_workday(w: dict) -> list[dict]:
    api = f"https://{w['host']}/wday/cxs/{w['tenant']}/{w['site']}/jobs"
    out = []
    for search in ("intern", "co-op"):
        for offset in range(0, 200, 20):
            data = get_json(api, data={"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": search})
            jobs = data.get("jobPostings", [])
            for j in jobs:
                url = f"https://{w['host']}/{w['site']}{j.get('externalPath', '')}"
                out.append(posting(w["company"], j.get("title", ""), [j.get("locationsText", "")], url,
                                   "Workday", workday_posted(j.get("postedOn", ""))))
            if len(jobs) < 20:
                break
    return out


def jobs() -> list[tuple[str, callable]]:
    ats = CONFIG.get("ats", {})
    tasks = [(f"list:{e['name']}", lambda e=e: from_github_list(e)) for e in CONFIG.get("github_lists", [])]
    tasks += [(f"greenhouse:{s}", lambda s=s: from_greenhouse(s)) for s in ats.get("greenhouse", [])]
    tasks += [(f"lever:{s}", lambda s=s: from_lever(s)) for s in ats.get("lever", [])]
    tasks += [(f"ashby:{s}", lambda s=s: from_ashby(s)) for s in ats.get("ashby", [])]
    tasks += [(f"smartrecruiters:{s}", lambda s=s: from_smartrecruiters(s)) for s in ats.get("smartrecruiters", [])]
    tasks += [(f"workday:{w['company']}", lambda w=w: from_workday(w)) for w in ats.get("workday", [])]
    return tasks


def collect() -> tuple[list[dict], dict]:
    report = {}

    def run(task):
        name, fn = task
        try:
            rows = fn()
            report[name] = {"ok": True, "fetched": len(rows)}
            return rows
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
            report[name] = {"ok": False, "error": str(e)[:160]}
            return []

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(run, jobs()))

    merged: dict[str, dict] = {}
    for rows in results:
        for p in rows:
            if not p["title"] or not p["url"]:
                continue
            if not is_intern_title(p["title"]) or not is_canada(p["locations"]):
                continue
            # Direct ATS sources win over lists for the same URL (fresher data)
            old = merged.get(p["id"])
            if old is None or (old["source"].startswith("Simplify") and not p["source"].startswith("Simplify")):
                merged[p["id"]] = p
    return list(merged.values()), report


# ---------------------------------------------------------------- merge + alerts

def load_previous() -> dict[str, dict]:
    if not OUT.exists():
        return {}
    try:
        return {p["id"]: p for p in json.loads(OUT.read_text()).get("postings", [])}
    except (json.JSONDecodeError, KeyError):
        return {}


def merge(current: list[dict], previous: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    today = NOW.date().isoformat()
    cutoff = (NOW - timedelta(days=CONFIG["filters"]["max_age_days"])).date().isoformat()
    new, kept = [], []
    for p in current:
        old = previous.get(p["id"])
        p["first_seen"] = old["first_seen"] if old else today
        if not old:
            new.append(p)
        if p["first_seen"] >= cutoff:
            kept.append(p)
    kept.sort(key=lambda p: (p["first_seen"], p.get("posted") or ""), reverse=True)
    return kept, new


def send_alerts(new: list[dict], first_run: bool) -> None:
    wanted = set(CONFIG["alerts"]["categories"])
    hits = [p for p in new if p["category"] in wanted]
    if first_run:
        print(f"First run: skipping alerts for {len(hits)} postings so you don't get 300 texts.")
        return
    if not hits:
        print("No new postings worth alerting on.")
        return
    n = CONFIG["alerts"]["max_lines"]
    lines = [f"{p['company']}: {p['title']} ({p['locations'][0] if p['locations'] else 'Canada'})" for p in hits[:n]]
    more = f"\n+{len(hits) - n} more" if len(hits) > n else ""
    msg = f"northbound: {len(hits)} new posting{'s' if len(hits) != 1 else ''}\n" + "\n".join(lines) + more

    if os.getenv("DRY_RUN"):
        print("---- alert (dry run) ----\n" + msg)
        return

    sid, token = os.getenv("TWILIO_SID"), os.getenv("TWILIO_TOKEN")
    frm, to = os.getenv("TWILIO_FROM"), os.getenv("ALERT_TO")
    if sid and token and frm and to:
        body = urllib.parse.urlencode({"From": frm, "To": to, "Body": msg[:1500]}).encode()
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=body)
        req.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode())
        try:
            urllib.request.urlopen(req, timeout=20)
            print("SMS sent.")
        except urllib.error.URLError as e:
            print(f"SMS failed: {e}", file=sys.stderr)

    hook = os.getenv("DISCORD_WEBHOOK_URL")
    if hook:
        links = "\n".join(f"[{p['company']}: {p['title']}]({p['url']})" for p in hits[:n])
        req = urllib.request.Request(hook, data=json.dumps({"content": f"**{len(hits)} new**\n{links}{more}"}).encode(),
                                     headers={**UA, "Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=20)
            print("Discord alert sent.")
        except urllib.error.URLError as e:
            print(f"Discord failed: {e}", file=sys.stderr)


def main() -> None:
    previous = load_previous()
    current, report = collect()
    if not current and previous:
        print("Every source came back empty. Keeping the old file instead of wiping it.", file=sys.stderr)
        sys.exit(1)
    kept, new = merge(current, previous)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated_at": NOW.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "count": len(kept),
        "sources": report,
        "postings": kept,
    }, indent=1, ensure_ascii=False))
    ok = sum(1 for r in report.values() if r["ok"])
    print(f"{len(kept)} Canadian postings ({len(new)} new). Sources ok: {ok}/{len(report)}")
    for name, r in sorted(report.items()):
        if not r["ok"]:
            print(f"  skipped {name}: {r['error']}")
    send_alerts(new, first_run=not previous)


if __name__ == "__main__":
    main()
