# northbound

My personal co-op hunt board: every Canadian internship and co-op posting worth a look, refreshed every 30 minutes, with an application tracker, a résumé bullet checker and an interview prep plan next to it.

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
GitHub Actions (every 30 min)
  └─ scraper/scrape.py
       ├─ Simplify's community lists on GitHub
       ├─ Greenhouse, Lever, Ashby, SmartRecruiters, Workday boards (scraper/config.toml)
       ├─ keeps intern/co-op titles in Canada, dedupes, keeps first-seen dates
       ├─ writes public/data/postings.json and commits it
       └─ emails new Canadian Software, Data & ML and Product roles (never the same job twice)
The live site reads postings.json straight from GitHub, so data commits don't trigger a rebuild
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

## ResumeRadar inside northbound

The Résumé and Interview prep pages call the ResumeRadar API (the same Lambdas and Bedrock model the ResumeRadar site uses):

- **Résumé:** upload your PDF once (it stays in this browser). Bullets are pulled out and checked automatically.
- **Check fit** on any posting or tracked application: 0-100 score, strengths, gaps, missing keywords, a 1-3 day project idea, and a tailoring plan. Greenhouse, Lever and Ashby job descriptions are fetched automatically. Others need a paste.
- **Interview prep:** a Today queue with spaced repetition for LeetCode, a prep room plus mock interview for everything at Interviewing or Online assessment, and story practice with scored feedback.

AI bullet rewrites and tailoring use one extra Lambda that lives in the ResumeRadar repo. Deploy it once:

```bash
cd ~/Desktop/coding/resumeradar && ./scripts/deploy-coach.sh
```

## Email alerts

1. Turn on 2-Step Verification for the Gmail account that will send the alerts, then create an app password at myaccount.google.com/apppasswords.
2. Add `EMAIL_TO`, `SMTP_USER` (the sending Gmail address) and `SMTP_PASSWORD` (the app password) as GitHub Actions secrets: `gh secret set EMAIL_TO` and so on.
3. Every 30-minute run that finds new Canadian Software, Data & ML or Product roles sends one email with Apply buttons. `scraper/state/alerted.json` remembers every job already emailed, so nothing is ever sent twice, even if a source drops out for a run.

## Terms

Canadian co-op terms: Winter = Jan-Apr (Spring means the same thing and is merged into Winter), Summer = May-Aug, Fall = Sep-Dec. Postings that only list terms before `earliest_term` in `scraper/config.toml` are dropped. Postings that don't name a term are kept.

## Local development

```bash
npm install
npm run scrape   # one-off refresh of public/data/postings.json (DRY_RUN=1 prints alerts instead of sending)
npm run watch    # 5-minute loop in the foreground
npm run dev      # http://localhost:3000
```

Stack: Next.js (static export), TypeScript, CSS modules, Python, GitHub Actions, Netlify Functions.
