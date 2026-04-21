# AI Market Map

Public-facing, read-only dashboard tracking 28 publicly listed companies across the AI ecosystem. Data refreshes on page load with Redis caching.

## Architecture

- **Frontend:** Next.js 14 App Router (Vercel free tier)
- **Backend:** Python FastAPI + yfinance (Render free tier)
- **Cache:** Upstash Redis (free tier)
- **Transcripts:** Git-committed Markdown files, manually curated
- **Scheduled jobs:** GitHub Actions cron (daily earnings detection)

## Local Development

### 1. Install Node dependencies

```bash
npm install
```

### 2. Set up the Python backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
# Fill in values — see comments in the file
```

Minimum for local dev (no Redis, no GitHub token):
```
PYTHON_BACKEND_URL=http://localhost:8000
ADMIN_PASSWORD=localpassword
```

### 4. Start the Next.js dev server

```bash
npm run dev
```

Open http://localhost:3000 for the dashboard, http://localhost:3000/admin for transcript ingestion.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Prod only | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Prod only | Upstash Redis token |
| `PYTHON_BACKEND_URL` | Yes | URL of the FastAPI backend |
| `ANTHROPIC_API_KEY` | For summaries | Claude API key |
| `ADMIN_PASSWORD` | Yes | Password for /admin page |
| `GITHUB_TOKEN` | Prod only | Token with contents:write for committing transcripts |
| `GITHUB_REPO` | Prod only | `owner/repo` format |
| `ALLOWED_ORIGINS` | Backend | Comma-separated CORS origins |

## Deploying

### Backend (Render)

1. Create a new Web Service on Render, pointing to the `/backend` directory
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set `ALLOWED_ORIGINS` to your Vercel URL

### Frontend (Vercel)

1. Import the repo into Vercel
2. Set all environment variables in the Vercel dashboard
3. Deploy — Next.js is auto-detected

## Adding a New Company

1. Add an entry to `data/companies.json` with ticker, name, sub_theme, exchange, CIK, and IR URL
2. Find the CIK at https://efts.sec.gov/LATEST/search-index?q=%22TICKER%22&forms=10-K
3. Create the events directory: `mkdir -p data/events/TICKER`
4. The daily GitHub Actions job will auto-detect earnings events going forward

## Ingesting a Transcript

1. Go to `/admin` and log in with your `ADMIN_PASSWORD`
2. Find the pending event for the company/quarter
3. Paste the full transcript text
4. Optionally add the source URL (e.g. the Seeking Alpha or IR page link)
5. Click **Save transcript + extract AI summary**

The admin page will:
- Save the transcript to `data/events/{TICKER}/{YYYY-Q#}-transcript.md`
- Update the event JSON to `transcript_status: "published"`
- Trigger `scripts/extract_ai_summary.py` (Claude extracts AI-relevant quotes)
- Commit all changes to git

If a transcript genuinely doesn't exist publicly, click **Mark unavailable** — this flips the status and links to the company's IR page.

## Known Limitations

- **yfinance is unofficial.** Yahoo Finance doesn't have a public API contract. Rate limits and schema changes can break data fetches without warning. The Redis cache reduces load significantly.
- **Transcripts depend on manual curation.** Only events where you paste a transcript will have AI summaries. Pending events show the date and EPS/revenue data only.
- **Financials lag.** Quarterly financials from yfinance are delayed and may not reflect the most recent filing.
- **ADR financials.** TSM, ASML, BABA, and BIDU file 6-K on EDGAR. The detect_new_earnings script handles this but EDGAR detection may be less reliable for these companies.
- **CapEx for smaller companies.** CRWV, NBIS, APLD, IREN may have sparse financials data depending on their filing history.

## Data Refresh Cadence

| Data | Cache TTL |
|------|-----------|
| Stock quotes | 60 seconds |
| News | 15 minutes |
| Financials | 24 hours |
| Earnings events | On page load (read from git) |
