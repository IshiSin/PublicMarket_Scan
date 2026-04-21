"""SEC EDGAR API service for earnings event detection."""

import httpx
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

EDGAR_BASE = "https://data.sec.gov/submissions/CIK{cik}.json"
EDGAR_HEADERS = {"User-Agent": "AI Market Map Dashboard contact@example.com"}


def get_recent_earnings_filings(cik: str, is_adr: bool = False) -> list[dict]:
    """
    Fetch recent 8-K (or 6-K for ADRs) filings related to earnings from EDGAR.
    Returns list of {date, form, accession_number, description}.
    """
    url = EDGAR_BASE.format(cik=cik.lstrip("0"))
    try:
        resp = httpx.get(url, timeout=15.0, headers=EDGAR_HEADERS)
        resp.raise_for_status()
        data = resp.json()

        filings = data.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        dates = filings.get("filingDate", [])
        accessions = filings.get("accessionNumber", [])
        descriptions = filings.get("primaryDocument", [])
        items = filings.get("items", [])

        target_form = "6-K" if is_adr else "8-K"
        results = []

        for i, form in enumerate(forms):
            if form != target_form:
                continue
            # For 8-K, filter to Item 2.02 (Results of Operations)
            item_str = items[i] if i < len(items) else ""
            if not is_adr and "2.02" not in str(item_str):
                continue

            results.append({
                "date": dates[i] if i < len(dates) else None,
                "form": form,
                "accession_number": accessions[i] if i < len(accessions) else None,
                "description": descriptions[i] if i < len(descriptions) else None,
            })

        # Return most recent 8 filings
        return results[:8]

    except Exception as e:
        logger.error("EDGAR fetch failed for CIK %s: %s", cik, e)
        return []


def is_adr_ticker(ticker: str) -> bool:
    """Tickers that file 6-K instead of 8-K."""
    return ticker in {"TSM", "ASML", "BABA", "BIDU"}
