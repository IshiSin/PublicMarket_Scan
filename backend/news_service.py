"""Yahoo Finance RSS news fetcher."""

import feedparser
import httpx
import re
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

RSS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"


def _parse_date(entry) -> str:
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def _is_relevant(headline: str, ticker: str, keywords: list[str]) -> bool:
    """Return True if the headline plausibly mentions the target company."""
    text = headline.lower()
    # Ticker match (e.g. "AMZN", "NVDA")
    if re.search(rf"\b{re.escape(ticker.lower())}\b", text):
        return True
    # Any keyword match (e.g. "amazon", "nvidia", "meta")
    for kw in keywords:
        if kw and len(kw) >= 3 and kw.lower() in text:
            return True
    return False


def _keywords_for(ticker: str, name: str) -> list[str]:
    """Build a list of lowercase match tokens from ticker + company name."""
    tokens = [ticker.lower()]
    # Each word in the company name that's at least 3 chars and not a stop word
    stop = {"the", "and", "for", "inc", "ltd", "llc", "plc", "corp", "group",
            "holding", "holdings", "technologies", "technology", "platforms",
            "semiconductor", "systems", "solutions", "services", "international"}
    for word in re.split(r"[\s\-&,]+", name):
        w = word.strip().lower()
        if len(w) >= 3 and w not in stop:
            tokens.append(w)
    return tokens


def get_news(ticker: str, name: str = "", limit: int = 5) -> list[dict]:
    """Fetch last N news items for a ticker, filtered to relevant headlines."""
    url = RSS_URL.format(ticker=ticker)
    keywords = _keywords_for(ticker, name)
    try:
        resp = httpx.get(url, timeout=10.0, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)

        relevant = []
        fallback = []

        for entry in feed.entries:
            headline = entry.get("title", "")
            item = {
                "ticker":       ticker,
                "headline":     headline,
                "source":       entry.get("source", {}).get("title", "Yahoo Finance") if hasattr(entry, "source") else "Yahoo Finance",
                "url":          entry.get("link", ""),
                "published_at": _parse_date(entry),
            }
            if _is_relevant(headline, ticker, keywords):
                relevant.append(item)
            else:
                fallback.append(item)
            if len(relevant) >= limit:
                break

        # If we didn't find enough relevant ones, pad with fallback
        result = relevant[:limit]
        if len(result) < limit:
            result += fallback[: limit - len(result)]
        return result

    except Exception as e:
        logger.warning("News fetch failed for %s: %s", ticker, e)
        return []
