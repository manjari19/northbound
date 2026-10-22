# northbound

My personal co-op hunt board: every Canadian internship and co-op posting worth a look, refreshed every two hours, with an application tracker, a résumé bullet checker and an interview prep plan next to it.

Inspired by [sweintern.dev](https://sweintern.dev), rebuilt for Canadian co-op terms.

## What's in it

| Page | What it does |
|---|---|
| **Home** | A live departure board of the newest software, data and product roles, plus where my applications stand and what to practice next |
| **Postings** | All Canadian intern and co-op roles. Search, filter by category, term, freshness and BC/remote, and set a tracking status on any row |
| **Tracker** | Applications grouped by status, notes, manual adds for myExperience or referral roles, a nudge after 21 quiet days, and backup/restore |
| **Résumé** | Line-by-line bullet checker (strong verb, a number, named stack, no filler, no em dashes or semicolons, active voice, length, repeated verbs), optional AI rewrites, and checklists for résumé, LinkedIn, GitHub and portfolio |
| **Interview prep** | Blind 75 plus a few NeetCode staples in learning order with progress and a revisit list, a STAR story bank mapped to 17 common behavioral questions, and resource links |

Tracker and prep progress live in `localStorage`, so there's no login or database. Use **Download backup** on the Tracker page to move between devices.

## How the data works

```
GitHub Actions (every 2h)
  └─ scraper/scrape.py
       ├─ Simplify's community lists on GitHub
       ├─ Greenhouse, Lever, Ashby, SmartRecruiters, Workday boards (scraper/config.toml)
       ├─ keeps intern/co-op titles in Canada, dedupes, keeps first-seen dates
       ├─ writes public/data/postings.json and commits it
       └─ texts/Discords new Software, Data & ML and Product roles
Netlify redeploys on the commit → site fetches /data/postings.json
```

Standard library Python only, no `requirements.txt` needed.

## Setup

1. **Push to GitHub**
   ```bash
   git remote add origin git@github.com:manjari19/northbound.git
   git push -u origin main
   ```
2. **Deploy on Netlify**: Add new site, import the repo. `netlify.toml` already sets the build command and the `out` folder.
3. **Let the Action commit**: repo Settings, Actions, General, Workflow permissions, choose *Read and write*.
4. **Alerts (optional)**: repo Settings, Secrets and variables, Actions. Add `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`, `ALERT_TO` for SMS, and/or `DISCORD_WEBHOOK_URL`.
5. **AI rewrites (optional)**: in Netlify, add `ANTHROPIC_API_KEY` as an environment variable and redeploy. Without it, the rule-based checker still works and the button explains it isn't set up.
6. Run the workflow once by hand (Actions, Scrape postings, Run workflow) to confirm every source loads. Failed sources are listed in the log and skipped, never fatal.

The first scraper run never sends alerts, so you won't get 300 texts at once.

## Adding companies

Edit `scraper/config.toml`. The slug is the bit in the careers URL:

- Greenhouse: `boards.greenhouse.io/<slug>`
- Lever: `jobs.lever.co/<slug>`
- Ashby: `jobs.ashbyhq.com/<slug>`
- SmartRecruiters: `jobs.smartrecruiters.com/<CompanyId>`
- Workday: from `https://<host>/<site>`, plus the tenant (usually the subdomain)

Alert categories, title filters and the age cutoff are in the same file.

## Local development

```bash
npm install
npm run scrape   # refresh public/data/postings.json (DRY_RUN=1 prints alerts instead of sending)
npm run dev      # http://localhost:3000
```

Stack: Next.js (static export), TypeScript, CSS modules, Python, GitHub Actions, Netlify Functions.
