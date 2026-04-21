"""Yahoo Finance RSS news fetcher."""

import feedparser
import httpx
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

RSS_URL = "https://finance.yahoo.com/rss/headline?s={ticker}"


def _parse_date(entry) -> str:
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def get_news(ticker: str, limit: int = 5) -> list[dict]:
    """Fetch last N news items for a ticker via Yahoo Finance RSS."""
    url = RSS_URL.format(ticker=ticker)
    try:
        # feedparser can fetch directly but using httpx for better timeout control
        resp = httpx.get(url, timeout=10.0, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)

        items = []
        for entry in feed.entries[:limit]:
            items.append({
                "ticker": ticker,
                "headline": entry.get("title", ""),
                "source": entry.get("source", {}).get("title", "Yahoo Finance") if hasattr(entry, "source") else "Yahoo Finance",
                "url": entry.get("link", ""),
                "published_at": _parse_date(entry),
            })
        return items
    except Exception as e:
        logger.warning("News fetch failed for %s: %s", ticker, e)
        return []
