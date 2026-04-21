#!/usr/bin/env python3
"""
Detect new earnings events for all 28 companies.
Runs daily via GitHub Actions cron.

Usage:
  python3 detect_new_earnings.py           # normal mode (yfinance + EDGAR)
  python3 detect_new_earnings.py --bootstrap  # create placeholders from calculated quarter dates
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data" / "events"
COMPANIES_FILE = REPO_ROOT / "data" / "companies.json"

EDGAR_BASE = "https://data.sec.gov/submissions/CIK{cik}.json"
EDGAR_HEADERS = {"User-Agent": "AI Market Map detect_earnings@example.com"}

ADR_TICKERS = {"TSM", "ASML", "BABA", "BIDU"}


def date_to_quarter(dt: date) -> str:
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def recent_quarters(n: int = 4) -> list[tuple[str, str]]:
    """Return the last N fiscal quarters as (quarter_label, approx_report_date)."""
    today = date.today()
    results = []
    # Walk back quarter by quarter
    d = today.replace(day=1)
    for _ in range(n + 2):
        q = (d.month - 1) // 3 + 1
        # Quarter end month
        q_end_month = q * 3
        q_end = date(d.year, q_end_month, 1)
        # Reports come ~30 days after quarter end
        report_approx = date(d.year, q_end_month, 1) + timedelta(days=30)
        if report_approx < today:
            label = f"{d.year}-Q{q}"
            results.append((label, report_approx.isoformat()))
        # Go back one quarter
        first_of_quarter = date(d.year, q_end_month - 2, 1)
        d = first_of_quarter - timedelta(days=1)
        d = d.replace(day=1)
        if len(results) >= n:
            break
    return results[:n]


def get_yfinance_earnings_dates(ticker: str) -> list[dict]:
    """Return recent past earnings dates. Tries multiple yfinance approaches."""
    try:
        import yfinance as yf
    except ImportError:
        return []

    t = yf.Ticker(ticker)

    # Approach 1: get_earnings_dates()
    try:
        hist = t.get_earnings_dates(limit=12)
        if hist is not None and not hist.empty:
            results = []
            now = datetime.now(timezone.utc)
            for idx_date, row in hist.iterrows():
                if hasattr(idx_date, "tzinfo") and idx_date.tzinfo is None:
                    idx_date = idx_date.replace(tzinfo=timezone.utc)
                if idx_date > now:
                    continue
                eps_est = row.get("EPS Estimate")
                eps_act = row.get("Reported EPS")
                results.append({
                    "date": idx_date.date().isoformat(),
                    "eps_estimate": float(eps_est) if eps_est is not None and str(eps_est) != "nan" else None,
                    "eps_actual": float(eps_act) if eps_act is not None and str(eps_act) != "nan" else None,
                })
            if results:
                return results[:4]
    except Exception as e:
        print(f"  [WARN] get_earnings_dates failed for {ticker}: {e}", file=sys.stderr)

    # Approach 2: quarterly_financials column dates
    try:
        qf = t.quarterly_financials
        if qf is not None and not qf.empty:
            results = []
            now = datetime.now(timezone.utc)
            for col in qf.columns[:4]:
                col_dt = col
                if hasattr(col_dt, "tzinfo") and col_dt.tzinfo is None:
                    col_dt = col_dt.replace(tzinfo=timezone.utc)
                if col_dt > now:
                    continue
                report_dt = col_dt + timedelta(days=30)
                if report_dt > now:
                    report_dt = now - timedelta(days=1)
                results.append({
                    "date": report_dt.date().isoformat(),
                    "eps_estimate": None,
                    "eps_actual": None,
                })
            if results:
                return results
    except Exception as e:
        print(f"  [WARN] quarterly_financials fallback failed for {ticker}: {e}", file=sys.stderr)

    return []


def get_edgar_filing_date(cik: str, is_adr: bool, target_date_str: str) -> str | None:
    try:
        url = EDGAR_BASE.format(cik=cik.lstrip("0"))
        resp = httpx.get(url, timeout=15.0, headers=EDGAR_HEADERS)
        resp.raise_for_status()
        data = resp.json()

        filings = data.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        dates = filings.get("filingDate", [])
        items = filings.get("items", [])

        target_form = "6-K" if is_adr else "8-K"
        target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")
        window_start = target_dt - timedelta(days=7)
        window_end = target_dt + timedelta(days=7)

        for i, form in enumerate(forms):
            if form != target_form:
                continue
            item_str = items[i] if i < len(items) else ""
            if not is_adr and "2.02" not in str(item_str):
                continue
            if i < len(dates):
                filing_dt = datetime.strptime(dates[i], "%Y-%m-%d")
                if window_start <= filing_dt <= window_end:
                    return dates[i]
    except Exception as e:
        print(f"  [WARN] EDGAR lookup failed for CIK {cik}: {e}", file=sys.stderr)
    return None


def fiscal_quarter_file(ticker: str, quarter: str) -> Path:
    return DATA_DIR / ticker / f"{quarter}.json"


def create_event_placeholder(
    ticker: str,
    quarter: str,
    report_date: str,
    eps_actual=None,
    eps_estimate=None,
    revenue_actual=None,
) -> Path:
    event = {
        "ticker": ticker,
        "fiscal_quarter": quarter,
        "report_date": report_date,
        "eps_actual": eps_actual,
        "eps_estimate": eps_estimate,
        "revenue_actual": revenue_actual,
        "revenue_estimate": None,
        "transcript_status": "pending",
        "transcript_source_url": None,
        "transcript_added_at": None,
        "ai_summary": None,
    }
    out_file = fiscal_quarter_file(ticker, quarter)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w") as f:
        json.dump(event, f, indent=2)
    return out_file


def bootstrap_mode(companies: list[dict]):
    """Create placeholder files for the last 4 quarters for every company."""
    print("Bootstrap mode: creating placeholders from calculated quarter dates...")
    quarters = recent_quarters(4)
    print(f"  Quarters: {[q for q, _ in quarters]}")
    new_files = []

    for company in companies:
        ticker = company["ticker"]
        for quarter, report_date in quarters:
            existing = fiscal_quarter_file(ticker, quarter)
            if existing.exists():
                continue
            out_file = create_event_placeholder(ticker, quarter, report_date)
            new_files.append(str(out_file.relative_to(REPO_ROOT)))
            print(f"  Created {ticker} {quarter}")

    print(f"\n{len(new_files)} files created.")
    return new_files


def normal_mode(companies: list[dict]):
    """Detect via yfinance + EDGAR with rate-limit delays."""
    new_files = []
    summary_lines = []

    for i, company in enumerate(companies):
        ticker = company["ticker"]
        cik = company["cik"]
        is_adr = ticker in ADR_TICKERS

        print(f"Processing {ticker}...")

        # Throttle: 2s between tickers to avoid Yahoo rate limits
        if i > 0:
            time.sleep(2)

        earnings_dates = get_yfinance_earnings_dates(ticker)
        if not earnings_dates:
            summary_lines.append(f"  {ticker}: no earnings dates found")
            continue

        for ed in earnings_dates:
            report_date = ed["date"]
            quarter = date_to_quarter(datetime.strptime(report_date, "%Y-%m-%d").date())
            existing = fiscal_quarter_file(ticker, quarter)

            if existing.exists():
                continue

            edgar_date = get_edgar_filing_date(cik, is_adr, report_date)
            if edgar_date:
                print(f"  Found EDGAR filing for {quarter} on {edgar_date}")

            out_file = create_event_placeholder(
                ticker=ticker,
                quarter=quarter,
                report_date=report_date,
                eps_actual=ed["eps_actual"],
                eps_estimate=ed["eps_estimate"],
            )
            new_files.append(str(out_file.relative_to(REPO_ROOT)))
            summary_lines.append(f"  {ticker} {quarter}: created placeholder")
            print(f"  Created {out_file.name}")

    print("\n=== Summary ===")
    for line in summary_lines:
        print(line)

    if new_files:
        print(f"\n{len(new_files)} new event file(s) created.")
    else:
        print("\nNo new events detected.")

    return new_files


def main():
    with open(COMPANIES_FILE) as f:
        companies = json.load(f)

    if "--bootstrap" in sys.argv:
        bootstrap_mode(companies)
    else:
        normal_mode(companies)


if __name__ == "__main__":
    main()
