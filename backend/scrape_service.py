"""
Transcript scraper using curl_cffi (Cloudflare bypass) + BeautifulSoup.
Supports HTML pages and PDFs.
Works on: investing.com, motleyfool.com, SEC EDGAR, most news sites, PDF links.
"""

import io
import logging
from urllib.parse import urlparse
from bs4 import BeautifulSoup

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

try:
    from curl_cffi import requests as cffi_requests
    HAS_CFFI = True
except ImportError:
    HAS_CFFI = False
    import httpx

logger = logging.getLogger(__name__)

# Site-specific content selectors (most specific first)
SELECTORS = [
    # Investing.com
    "div.articlePage",
    "div[class*='article-content']",
    # Motley Fool
    "div.article-body",
    "div[class*='article']",
    # SEC EDGAR
    "div.formContent",
    # Generic fallbacks
    "article",
    "main",
    "div[class*='content']",
    "div[class*='body']",
    "div.WYSIWYG",
]


def _fetch_html(url: str) -> str:
    """Fetch URL, bypassing Cloudflare where needed."""
    if HAS_CFFI:
        resp = cffi_requests.get(
            url,
            impersonate="chrome120",
            timeout=25,
            headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        resp.raise_for_status()
        return resp.text
    else:
        import httpx
        resp = httpx.get(
            url,
            timeout=20,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        resp.raise_for_status()
        return resp.text


def _extract_text(html: str) -> str | None:
    """Extract main article text from HTML."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "header", "footer",
                     "aside", "noscript", "iframe", "button", "form"]):
        tag.decompose()

    # Try site-specific selectors
    for sel in SELECTORS:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(separator="\n", strip=True)
            if len(text) > 400:
                return _clean_text(text)

    # Last resort: body text
    body = soup.find("body")
    if body:
        text = body.get_text(separator="\n", strip=True)
        if len(text) > 400:
            return _clean_text(text)

    return None


def _clean_text(text: str) -> str:
    """Remove excessive blank lines and noise."""
    lines = text.splitlines()
    cleaned = []
    prev_blank = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(stripped)
            prev_blank = False
    return "\n".join(cleaned).strip()


def _extract_pdf(content: bytes) -> str | None:
    """Extract text from a PDF file."""
    if not HAS_PDF:
        return None
    try:
        pages = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text.strip())
        return "\n\n".join(pages) if pages else None
    except Exception as e:
        logger.error("PDF extraction failed: %s", e)
        return None


def _is_pdf_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith(".pdf")


def scrape_transcript(url: str) -> dict:
    """
    Fetch and extract transcript text from a URL.
    Handles both HTML pages and PDF files.
    Returns {"text": str, "url": str, "char_count": int} or {"error": str}.
    """
    try:
        if _is_pdf_url(url):
            # Fetch PDF as binary
            if HAS_CFFI:
                from curl_cffi import requests as cffi_requests
                resp = cffi_requests.get(url, impersonate="chrome120", timeout=30)
                content = resp.content
            else:
                import httpx
                resp = httpx.get(url, timeout=30, follow_redirects=True,
                                 headers={"User-Agent": "Mozilla/5.0"})
                content = resp.content

            text = _extract_pdf(content)
            if not text:
                return {"error": "Could not extract text from PDF"}
            return {"text": text, "url": url, "char_count": len(text)}

        else:
            html = _fetch_html(url)
            text = _extract_text(html)
            if not text:
                return {"error": "Could not extract article text from this page"}
            return {"text": text, "url": url, "char_count": len(text)}

    except Exception as e:
        logger.error("Scrape failed for %s: %s", url, e)
        return {"error": str(e)}
