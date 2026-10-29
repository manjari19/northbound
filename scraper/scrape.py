"""northbound scraper.

Pulls internship / co-op postings from community GitHub lists and company ATS boards,
keeps the Canadian ones, merges them with the previous run (so "first seen" dates stick),
writes public/data/postings.json, and texts you about new ones.

Standard library only. Run:  python scraper/scrape.py
Env (all optional):
  EMAIL_TO, SMTP_USER, SMTP_PASSWORD                -> email alerts (Gmail by default)
  SMTP_HOST, SMTP_PORT                              -> another mail server (default smtp.gmail.com:465)
  TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, ALERT_TO   -> SMS alerts
  DISCORD_WEBHOOK_URL                               -> Discord alerts
  DRY_RUN=1                                         -> print alerts instead of sending
  NB_OUT=path                                       -> write somewhere other than public/data/postings.json
  NB_NOTIFY=1                                       -> macOS notification for new postings
Secrets can also live in a .env file at the repo root (never committed).
"""
from __future__ import annotations

import base64
import smtplib
import ssl
import subprocess
import hashlib
import json
import os
import re
import sys
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from html import escape
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path) -> None:
    """Minimal .env reader: KEY=value lines, # comments, optional quotes. Real env vars win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


load_dotenv(ROOT / ".env")
CONFIG = tomllib.loads((ROOT / "scraper" / "config.toml").read_text())
OUT = Path(os.getenv("NB_OUT") or ROOT / "public" / "data" / "postings.json")
SEED = ROOT / "public" / "data" / "postings.json"
CACHE = ROOT / "scraper" / ".cache"
# Every posting ID that has ever been emailed, so a job is never sent twice even if a source drops out for a run
ALERTED = ROOT / "scraper" / "state" / "alerted.json"
# "Today" means today where you live, not in UTC (set TZ in the workflow if you move)
LOCAL = ZoneInfo(os.getenv("NB_TZ", "America/Vancouver"))
NOW = datetime.now(LOCAL)
UA = {"User-Agent": "northbound-scraper/1.0 (personal job tracker)"}

# python.org builds on macOS ship without trusted root certificates. Use certifi's if it's installed.
try:
    import certifi  # type: ignore

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

# ---------------------------------------------------------------- helpers

PROVINCES = r"(ON|BC|QC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)"
CANADA_RE = re.compile(
    r"\bcanada\b|\bcanadian\b|,\s*" + PROVINCES + r"\b|\b(ontario|british columbia|quebec|québec|alberta|"
    r"manitoba|saskatchewan|nova scotia|new brunswick|newfoundland)\b|\b(toronto|vancouver|montreal|montréal|"
    r"ottawa|waterloo|kitchener|calgary|edmonton|burnaby|richmond, bc|surrey, bc|markham|mississauga|"
    r"halifax|winnipeg|victoria, bc|quebec city|gatineau|oakville|vaughan|brampton|london, on|hamilton, on)\b",
    re.IGNORECASE,
)


US_STATES = ("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND "
             "OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split()


def _is_canada_loc(loc: str) -> bool:
    if not CANADA_RE.search(loc or ""):
        return False
    # "Vancouver, WA" and friends are American
    return "canada" in loc.lower() or not re.search(r",\s*(" + "|".join(US_STATES) + r")\b", loc)


def is_canada(locations: list[str]) -> bool:
    return any(_is_canada_loc(loc) for loc in locations)


US_RE = re.compile(
    r"\b(usa|u\.s\.a?\.?|united states|us remote|remote,? us|remote in usa)\b|,\s*(" + "|".join(US_STATES) + r")\b|"
    r"\b(nyc|sf|bay area|silicon valley|new york|san francisco|seattle|boston|austin|chicago|los angeles|"
    r"san jose|mountain view|menlo park|palo alto|sunnyvale|redmond|cupertino|santa clara|atlanta|denver|"
    r"washington|california|texas|virginia|massachusetts|illinois|pennsylvania|north carolina|georgia|"
    r"colorado|michigan|ohio|florida|minnesota|arizona|oregon|maryland|new jersey|utah)\b",
    re.IGNORECASE,
)
REMOTE_RE = re.compile(r"\bremote\b|\banywhere\b", re.I)
NA_WORDS = {"", "us", "usa", "u s", "united states", "canada", "ca", "north america", "americas", "na", "anywhere"}


def is_na_remote(loc: str) -> bool:
    """'Remote', 'Remote in USA', 'Remote - North America' count. 'Remote in UK' doesn't."""
    if not REMOTE_RE.search(loc or ""):
        return False
    rest = re.sub(r"\b(remote|in|from|only|friendly|hybrid|or)\b|[^a-z ]", " ", loc.lower())
    return re.sub(r"\s+", " ", rest).strip() in NA_WORDS


def regions_of(locations: list[str]) -> list[str]:
    """Which of Canada / US / Remote a posting covers. A posting can be in several."""
    out = []
    if is_canada(locations):
        out.append("Canada")
    # "London, ON" and "Vancouver, WA"-style clashes: only count US for locations that aren't Canadian
    if any(US_RE.search(l or "") and not _is_canada_loc(l) for l in locations):
        out.append("US")
    if not out and any(is_na_remote(l) for l in locations):
        out.append("Remote")
    return out


REGIONS = set(CONFIG["filters"].get("regions", ["Canada"]))


def wanted_region(locations: list[str]) -> bool:
    return bool(REGIONS.intersection(regions_of(locations)))


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


# Canadian co-op terms: Winter = Jan-Apr (Spring means the same thing), Summer = May-Aug, Fall = Sep-Dec
TERM_RE = re.compile(r"\b(winter|spring|summer|fall|autumn)\s*(?:term\s*)?[,']?\s*(20\d\d)\b", re.I)
SEASON = {"winter": "Winter", "spring": "Winter", "summer": "Summer", "fall": "Fall", "autumn": "Fall"}
SEASON_ORDER = {"Winter": 1, "Summer": 2, "Fall": 3}


TERM_RE_YEAR_FIRST = re.compile(r"\b(20\d\d)\s*[-,]?\s*(winter|spring|summer|fall|autumn)\b", re.I)


def norm_term(raw: str) -> str | None:
    m = TERM_RE.search(raw or "")
    if m:
        return f"{SEASON[m.group(1).lower()]} {m.group(2)}"
    m = TERM_RE_YEAR_FIRST.search(raw or "")
    if m:
        return f"{SEASON[m.group(2).lower()]} {m.group(1)}"
    return None


def term_key(term: str) -> int:
    season, year = term.split()
    return int(year) * 10 + SEASON_ORDER[season]


def terms_from(text: str) -> list[str]:
    found = [m.group(0) for m in TERM_RE.finditer(text or "")]
    found += [m.group(0) for m in TERM_RE_YEAR_FIRST.finditer(text or "")]
    return norm_terms(found)


def norm_terms(raw) -> list[str]:
    out = {t for t in (norm_term(r) for r in raw or []) if t}
    return sorted(out, key=term_key)


EARLIEST = norm_term(CONFIG["filters"].get("earliest_term", "Winter 2027"))


def current_terms(terms: list[str]) -> list[str] | None:
    """Drops terms before EARLIEST. Returns None when every listed term is in the past (posting is stale).
    Postings with no term at all are kept, since many companies don't say."""
    if not terms:
        return []
    keep = [t for t in terms if term_key(t) >= term_key(EARLIEST)]
    return keep or None


def pid(url: str) -> str:
    clean = re.sub(r"[?#].*$", "", url.strip().lower()).rstrip("/")
    return hashlib.sha1(clean.encode()).hexdigest()[:12]


def open_url(req, timeout: int = 25):
    return urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX)


def get_json(url: str, *, data: dict | None = None, timeout: int = 25):
    body = json.dumps(data).encode() if data is not None else None
    headers = dict(UA)
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers)
    with open_url(req, timeout) as r:
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


def posting(company, title, locations, url, source, posted=None, terms=None, category_hint=None, pay=None, rank=0):
    """rank: 0 = straight from the company's job board, 1 = from a community list. Lower wins on duplicates."""
    locations = [l.strip() for l in locations if l and l.strip()]
    return {
        "id": pid(url),
        "company": company.strip(),
        "title": re.sub(r"\s+", " ", title).strip(),
        "locations": locations,
        "url": url,
        "source": source,
        "category": categorize(title, category_hint),
        "terms": norm_terms(terms) if terms else terms_from(title),
        "posted": posted,
        "pay": pay,
        "regions": regions_of(locations),
        "rank": rank,
    }


# ---------------------------------------------------------------- sources

CACHE_VERSION = 3  # bump when the way rows are built changes, so old cached rows get rebuilt


def _list_cache() -> dict:
    try:
        data = json.loads((CACHE / "lists.json").read_text())
        return data if data.get("_v") == CACHE_VERSION else {}
    except (OSError, json.JSONDecodeError):
        return {}


def from_github_list(entry: dict) -> list[dict]:
    """These lists are ~13 MB, so send the last ETag and reuse our filtered rows when nothing changed.
    That keeps a 5-minute loop polite: most runs get a tiny 304 instead of the whole file."""
    cache = _list_cache()
    cached = cache.get(entry["url"])
    headers = dict(UA)
    if cached and cached.get("etag"):
        headers["If-None-Match"] = cached["etag"]
    try:
        with open_url(urllib.request.Request(entry["url"], headers=headers), 60) as r:
            rows = json.loads(r.read().decode("utf-8"))
            etag = r.headers.get("ETag")
    except urllib.error.HTTPError as e:
        if e.code == 304 and cached:
            return cached["rows"]
        raise
    out = []
    for x in rows:
        if not x.get("active") or not x.get("is_visible", True):
            continue
        locs = x.get("locations") or []
        if not wanted_region(locs) or not is_intern_title(x.get("title", "")):
            continue
        terms = norm_terms(x.get("terms")) or terms_from(x["title"])
        out.append(posting(x["company_name"], x["title"], locs, x["url"], entry["name"],
                           iso(x.get("date_posted")), terms or None, x.get("category"), rank=1))
    if etag:
        CACHE.mkdir(parents=True, exist_ok=True)
        cache = _list_cache()
        cache["_v"] = CACHE_VERSION
        cache[entry["url"]] = {"etag": etag, "rows": out}
        (CACHE / "lists.json").write_text(json.dumps(cache))
    return out


TAG_RE = re.compile(r"<[^>]+>")
MD_LINK_RE = re.compile(r"\]\((https?://[^)\s]+)\)")
HREF_RE = re.compile(r'href="(https?://[^"]+)"')
IMG_HOSTS = ("imgur.com", "shields.io", "githubusercontent.com/assets", "user-attachments")


def _cell_text(cell: str) -> str:
    cell = TAG_RE.sub("", cell)
    cell = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", cell)          # images
    cell = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", cell)     # [text](url) -> text
    return re.sub(r"[*_`]|&nbsp;", " ", cell).strip()


def _cell_url(cell: str) -> str | None:
    urls = HREF_RE.findall(cell) + MD_LINK_RE.findall(cell)
    urls = [u for u in urls if not any(h in u for h in IMG_HOSTS)]
    return urls[0] if urls else None


def _md_date(text: str) -> str | None:
    text = text.strip()
    m = re.fullmatch(r"(\d+)\s*(d|day|days|h|hr|hrs|mo)", text, re.I)
    if m:
        n, unit = int(m.group(1)), m.group(2).lower()
        days = 0 if unit.startswith("h") else n * 30 if unit == "mo" else n
        return (NOW - timedelta(days=days)).date().isoformat()
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d", "%b %d"):
        try:
            d = datetime.strptime(text, fmt)
            if fmt == "%b %d":  # no year: assume the most recent such date
                d = d.replace(year=NOW.year)
                if d.date() > NOW.date():
                    d = d.replace(year=NOW.year - 1)
            return d.date().isoformat()
        except ValueError:
            pass
    return None


COLS = {
    "company": ("company",),
    "title": ("position", "role", "title", "job"),
    "location": ("location", "locations"),
    "pay": ("salary", "pay", "compensation"),
    "link": ("posting", "apply", "application", "link"),
    "date": ("age", "date posted", "date", "posted"),
}


def from_markdown_list(entry: dict) -> list[dict]:
    """README tables like | Company | Role | Location | Apply | Date Posted |. Columns are matched by header name."""
    req = urllib.request.Request(entry["url"], headers=UA)
    with open_url(req, 60) as r:
        text = r.read().decode("utf-8")
    out, cols, last_company = [], None, ""
    for line in text.splitlines():
        if not line.lstrip().startswith("|"):
            cols = None if not line.strip() else cols
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        heads = [c.lower() for c in map(_cell_text, cells)]
        if "company" in heads:
            cols = {key: next((i for i, h in enumerate(heads) if h in names), None) for key, names in COLS.items()}
            continue
        if not cols or cols["company"] is None or cols["title"] is None:
            continue

        def get(key):
            i = cols.get(key)
            return cells[i] if i is not None and i < len(cells) else ""

        link_cell = get("link")
        if "🔒" in line or "closed" in _cell_text(link_cell).lower():
            continue
        url = _cell_url(link_cell) or _cell_url(get("title"))
        company = _cell_text(get("company"))
        if company in ("↳", "") and last_company:
            company = last_company
        last_company = company
        title = _cell_text(get("title"))
        if not url or not title:
            continue
        locs = [l.strip() for l in re.split(r"<br\s*/?>|</br>|;| / ", get("location")) if l.strip()]
        locs = [_cell_text(l) for l in locs] or [_cell_text(get("location"))]
        if not wanted_region(locs) or not is_intern_title(title):
            continue
        pay = _cell_text(get("pay")) or None
        out.append(posting(company, title, locs, url, entry["name"], _md_date(_cell_text(get("date"))),
                           pay=pay if pay and pay not in ("-", "N/A") else None, rank=1))
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
    q = urllib.parse.urlencode({"q": "intern", "limit": 100})
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
        for offset in range(0, 100, 20):
            data = get_json(api, data={"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": search},
                            timeout=60)
            jobs = data.get("jobPostings", [])
            for j in jobs:
                url = f"https://{w['host']}/{w['site']}{j.get('externalPath', '')}"
                out.append(posting(w["company"], j.get("title", ""), [j.get("locationsText", "")], url,
                                   "Workday", workday_posted(j.get("postedOn", ""))))
            if len(jobs) < 20:
                break
    return out


def from_amazon(_: str = "") -> list[dict]:
    """amazon.jobs has a public search JSON endpoint."""
    out = []
    countries = [c for r, c in (("Canada", "CAN"), ("US", "USA")) if r in REGIONS] or ["CAN"]
    for q, country in [(q, c) for q in ("intern", "co-op") for c in countries]:
      for offset in range(0, 100, 10):
        params = urllib.parse.urlencode({"base_query": q, "country": country, "result_limit": 10,
                                         "offset": offset, "sort": "recent"})
        data = get_json(f"https://www.amazon.jobs/en/search.json?{params}")
        page = data.get("jobs", [])
        for j in page:
            loc = j.get("normalized_location") or j.get("location") or ""
            url = "https://www.amazon.jobs" + (j.get("job_path") or "")
            posted = None
            try:
                posted = datetime.strptime(j.get("posted_date", ""), "%B %d, %Y").date().isoformat()
            except ValueError:
                pass
            out.append(posting("Amazon", j.get("title", ""), [loc], url, "Amazon", posted))
        if len(page) < 10:
            break
    return out


def from_eightfold(e: dict) -> list[dict]:
    """Eightfold career sites (Microsoft, Qualcomm and others) share one public JSON API."""
    out = []
    places = [p for r, p in (("Canada", "Canada"), ("US", "United States")) if r in REGIONS] or ["Canada"]
    for q, place in [(q, p) for q in ("intern", "co-op") for p in places]:
        params = urllib.parse.urlencode({"domain": e["domain"], "query": q, "location": place, "start": 0, "num": 100})
        data = get_json(f"https://{e['host']}/api/apply/v2/jobs?{params}")
        for j in data.get("positions", []):
            locs = j.get("locations") or [j.get("location", "")]
            url = j.get("canonicalPositionUrl") or f"https://{e['host']}/careers/job/{j.get('id')}"
            out.append(posting(e["company"], j.get("name", ""), locs, url, "Eightfold", iso(j.get("t_create"))))
    return out


def jobs() -> list[tuple[str, callable]]:
    ats = CONFIG.get("ats", {})
    tasks = [(f"list:{e['name']}", lambda e=e: from_github_list(e)) for e in CONFIG.get("github_lists", [])]
    tasks += [(f"list:{e['name']}", lambda e=e: from_markdown_list(e)) for e in CONFIG.get("markdown_lists", [])]
    tasks += [(f"greenhouse:{s}", lambda s=s: from_greenhouse(s)) for s in ats.get("greenhouse", [])]
    tasks += [(f"lever:{s}", lambda s=s: from_lever(s)) for s in ats.get("lever", [])]
    tasks += [(f"ashby:{s}", lambda s=s: from_ashby(s)) for s in ats.get("ashby", [])]
    tasks += [(f"smartrecruiters:{s}", lambda s=s: from_smartrecruiters(s)) for s in ats.get("smartrecruiters", [])]
    tasks += [(f"workday:{w['company']}", lambda w=w: from_workday(w)) for w in ats.get("workday", [])]
    tasks += [(f"eightfold:{e['company']}", lambda e=e: from_eightfold(e)) for e in ats.get("eightfold", [])]
    if ats.get("amazon"):
        tasks.append(("amazon", from_amazon))
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
    alias: dict[str, str] = {}  # same job listed under different URLs -> one id
    for rows in results:
        for p in rows:
            if not p["title"] or not p["url"]:
                continue
            if not is_intern_title(p["title"]) or not wanted_region(p["locations"]):
                continue
            terms = current_terms(norm_terms(p["terms"]))
            if terms is None:
                continue  # only lists terms that have already started
            p["terms"] = terms
            if is_stale(p):
                continue
            p.setdefault("rank", 0)
            p.setdefault("pay", None)
            p["regions"] = regions_of(p["locations"])
            key = dup_key(p)
            pid_ = alias.get(key, p["id"])
            alias.setdefault(key, pid_)
            old = merged.get(pid_)
            if old is None:
                merged[p["id"]] = p
                alias[key] = p["id"]
                continue
            # Same job from two places: keep the company's own link, fill gaps from the other copy
            best, other = (p, old) if p["rank"] < old["rank"] else (old, p)
            best["id"] = old["id"]  # keep the id stable so first-seen dates and your tracker don't reset
            best["pay"] = best.get("pay") or other.get("pay")
            best["terms"] = norm_terms(best["terms"] + other["terms"])
            dates = [d for d in (best.get("posted"), other.get("posted")) if d]
            best["posted"] = min(dates) if dates else None
            if best["category"] == "Other":
                best["category"] = other["category"]
            merged[old["id"]] = best
    for p in merged.values():
        p.pop("rank", None)
    return list(merged.values()), report


TITLE_SYNONYMS = {"ml": "machine learning", "ai": "artificial intelligence", "swe": "software engineer",
                  "sde": "software development engineer", "dev": "developer", "co op": "coop", "co-op": "coop"}
TITLE_NOISE = {"intern", "internship", "the", "and", "of", "for", "a", "an", "to", "in", "at", "with",
               "winter", "spring", "summer", "fall", "term", "months", "month", "us", "usa", "canada", "remote"}


def dup_key(p: dict) -> str:
    """Two listings are the same job when company, first city and the set of meaningful title words match.
    So "ML Systems SDE Intern, Annapurna Labs - 2027" == "Machine Learning Systems SDE Intern - Annapurna Labs"."""
    norm = lambda s: re.sub(r"[^a-z0-9]+", "", s.lower())
    company = norm(re.sub(r"\b(inc|llc|ltd|corp|corporation|limited|co)\b\.?", "", p["company"], flags=re.I))
    title = p["title"].lower()
    for short, full in TITLE_SYNONYMS.items():
        title = re.sub(rf"\b{re.escape(short)}\b", full, title)
    words = {w for w in re.findall(r"[a-z]+", title) if w not in TITLE_NOISE}
    first_city = norm((p["locations"] or [""])[0].split(",")[0])
    return f"{company}|{first_city}|{' '.join(sorted(words))}"


YEAR_RE = re.compile(r"\b(20\d\d)\b")


def is_stale(p: dict) -> bool:
    """Old postings that lists never took down: posted long ago, or only mentioning past years in the title."""
    if p.get("posted"):
        age = (NOW.date() - datetime.fromisoformat(p["posted"]).date()).days
        if age > CONFIG["filters"]["max_age_days"]:
            return True
    years = [int(y) for y in YEAR_RE.findall(p["title"])]
    return bool(years) and not p["terms"] and max(years) < int(EARLIEST.split()[1])


# ---------------------------------------------------------------- merge + alerts

def previous_sources() -> set[str]:
    src = OUT if OUT.exists() else SEED
    try:
        return set(json.loads(src.read_text()).get("sources", {}))
    except (OSError, json.JSONDecodeError):
        return set()


def load_previous() -> dict[str, dict]:
    # A fresh local file starts from the committed data, so the first local run can alert right away
    src = OUT if OUT.exists() else SEED
    if not src.exists():
        return {}
    try:
        return {p["id"]: p for p in json.loads(src.read_text()).get("postings", [])}
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


def load_alerted() -> dict[str, str]:
    try:
        return json.loads(ALERTED.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def record_alerted(ids: list[str]) -> None:
    """Remember emailed IDs. Entries older than 120 days are pruned to keep the file small."""
    ledger = load_alerted()
    today = NOW.date().isoformat()
    for i in ids:
        ledger.setdefault(i, today)
    cutoff = (NOW - timedelta(days=120)).date().isoformat()
    ledger = {k: v for k, v in ledger.items() if v >= cutoff}
    ALERTED.parent.mkdir(parents=True, exist_ok=True)
    ALERTED.write_text(json.dumps(dict(sorted(ledger.items())), indent=0))


def send_alerts(new: list[dict], first_run: bool) -> None:
    wanted = set(CONFIG["alerts"]["categories"])
    alert_regions = set(CONFIG["alerts"].get("regions", ["Canada", "Remote"]))
    already = load_alerted()
    hits = [p for p in new if p["category"] in wanted and alert_regions.intersection(p.get("regions", []))
            and p["id"] not in already]
    if first_run or not ALERTED.exists():
        record_alerted([p["id"] for p in hits])
        print(f"First run: recorded {len(hits)} postings as already seen, no email sent.")
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
        if os.getenv("EMAIL_TO"):
            print(f"(would also email {len(hits)} postings to {os.getenv('EMAIL_TO')})")
        return

    if send_email(hits):
        record_alerted([p["id"] for p in hits])

    sid, token = os.getenv("TWILIO_SID"), os.getenv("TWILIO_TOKEN")
    frm, to = os.getenv("TWILIO_FROM"), os.getenv("ALERT_TO")
    if sid and token and frm and to:
        body = urllib.parse.urlencode({"From": frm, "To": to, "Body": msg[:1500]}).encode()
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=body)
        req.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode())
        try:
            open_url(req, 20)
            print("SMS sent.")
        except urllib.error.URLError as e:
            print(f"SMS failed: {e}", file=sys.stderr)

    if os.getenv("NB_NOTIFY", "1" if os.getenv("NB_LOCAL") else "0") == "1" and sys.platform == "darwin":
        first = hits[0]
        title = f"{len(hits)} new posting{'s' if len(hits) != 1 else ''}"
        text = f"{first['company']}: {first['title']}" + (f" (+{len(hits) - 1} more)" if len(hits) > 1 else "")
        script = f'display notification {json.dumps(text)} with title "northbound" subtitle {json.dumps(title)} sound name "Glass"'
        subprocess.run(["osascript", "-e", script], check=False)

    hook = os.getenv("DISCORD_WEBHOOK_URL")
    if hook:
        links = "\n".join(f"[{p['company']}: {p['title']}]({p['url']})" for p in hits[:n])
        req = urllib.request.Request(hook, data=json.dumps({"content": f"**{len(hits)} new**\n{links}{more}"}).encode(),
                                     headers={**UA, "Content-Type": "application/json"})
        try:
            open_url(req, 20)
            print("Discord alert sent.")
        except urllib.error.URLError as e:
            print(f"Discord failed: {e}", file=sys.stderr)


def send_email(hits: list[dict]) -> bool:
    """Returns True only when the email actually went out."""
    to, user = os.getenv("EMAIL_TO"), os.getenv("SMTP_USER")
    password = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "")  # Gmail shows app passwords with spaces
    if not (to and user and password):
        print("Email not configured (EMAIL_TO, SMTP_USER, SMTP_PASSWORD), skipping.")
        return False
    shown = hits[:25]
    names = ", ".join(dict.fromkeys(p["company"] for p in shown[:3]))
    more = len({p["company"] for p in hits}) - len(dict.fromkeys(p["company"] for p in shown[:3]))
    msg = EmailMessage()
    msg["Subject"] = f"{len(hits)} new co-op posting{'s' if len(hits) != 1 else ''}: {names}" + (f" +{more} more" if more > 0 else "")
    msg["From"] = f"northbound <{user}>"
    msg["To"] = to

    def where(p):
        return "; ".join(p["locations"][:2]) or "Canada"

    def when(p):
        return " | ".join(x for x in (", ".join(p["terms"]) or "Term not listed", p.get("pay")) if x)

    msg.set_content("\n\n".join(f"{p['company']}: {p['title']}\n{where(p)} | {when(p)}\n{p['url']}" for p in shown)
                    + (f"\n\n+{len(hits) - len(shown)} more on your board." if len(hits) > len(shown) else ""))
    rows = "".join(
        f"""<tr><td style="padding:12px 0;border-bottom:1px solid #e3e8f1">
        <div style="font-weight:600;font-size:15px">{escape(p['company'])}</div>
        <div style="font-size:15px;margin:2px 0">{escape(p['title'])}</div>
        <div style="color:#55607d;font-size:13px">{escape(where(p))} &nbsp;|&nbsp; {escape(when(p))} &nbsp;|&nbsp; {escape(p['category'])}</div>
        <a href="{escape(p['url'])}" style="display:inline-block;margin-top:8px;background:#f2b134;color:#1a1405;padding:6px 12px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px">Apply</a>
        </td></tr>"""
        for p in shown
    )
    extra = f'<p style="color:#55607d">+{len(hits) - len(shown)} more on your board.</p>' if len(hits) > len(shown) else ""
    board = os.getenv("BOARD_URL", "http://localhost:3000").rstrip("/")
    ids = ",".join(p["id"] for p in hits[:60])
    extra += (f'<p style="margin-top:18px"><a href="{escape(board)}/postings/?ids={ids}" '
              f'style="color:#0b7563;font-weight:600">See these on your board</a></p>')
    msg.add_alternative(f"""<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#121a33;max-width:560px">
      <h2 style="margin:0 0 4px;font-size:20px">{len(hits)} new posting{'s' if len(hits) != 1 else ''}</h2>
      <p style="margin:0 0 8px;color:#55607d">Found {NOW:%b %-d, %-I:%M %p}. Apply the day it posts.</p>
      <table style="width:100%;border-collapse:collapse">{rows}</table>{extra}</div>""", subtype="html")

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=SSL_CTX, timeout=30) as s:
                s.login(user, password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls(context=SSL_CTX)
                s.login(user, password)
                s.send_message(msg)
        print(f"Email sent to {to}.")
        return True
    except smtplib.SMTPAuthenticationError:
        print("Email failed: the mail server rejected the login. For Gmail, SMTP_PASSWORD must be an app password, "
              "not your normal password.", file=sys.stderr)
    except (smtplib.SMTPException, OSError) as e:
        print(f"Email failed: {e}", file=sys.stderr)
    return False


def main() -> None:
    previous = load_previous()
    old_sources = previous_sources()
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
    regions = Counter(r for p in kept for r in p.get("regions", []))
    print(f"{len(kept)} postings ({', '.join(f'{n} {r}' for r, n in regions.most_common())}), {len(new)} new. "
          f"Sources ok: {ok}/{len(report)}")
    for name, r in sorted(report.items()):
        if not r["ok"]:
            print(f"  skipped {name}: {r['error']}")
    added = set(report) - old_sources
    if previous and added:
        # Newly added sources would make every posting they carry look "new". Skip one round of alerts.
        print(f"Added {len(added)} new source(s), so this run is a quiet warm-up with no alerts.")
        record_alerted([p["id"] for p in new])
        return
    send_alerts(new, first_run=not previous)


if __name__ == "__main__":
    main()
