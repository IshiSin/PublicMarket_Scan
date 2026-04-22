#!/usr/bin/env python3
"""
Generate AI-focused key takeaways from an earnings transcript using Groq (Llama 3.3 70B).

Usage:
  python generate_takeaways.py <TICKER> <FISCAL_QUARTER>
  python generate_takeaways.py META 2025-Q4
  python generate_takeaways.py --all          # process all transcripts missing takeaways

Requires:
  GROQ_API_KEY env var (free at console.groq.com)

Output:
  data/events/<TICKER>/<QUARTER>-takeaways.md
"""

import json
import os
import sys
import httpx
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR  = REPO_ROOT / "data" / "events"
EVALS_FILE = REPO_ROOT / "evals" / "takeaway_criteria.json"

# Provider config — set TAKEAWAYS_PROVIDER=groq to use Groq instead
_PROVIDER = os.environ.get("TAKEAWAYS_PROVIDER", "openrouter").lower()

if _PROVIDER == "groq":
    API_URL   = "https://api.groq.com/openai/v1/chat/completions"
    MODEL     = "llama-3.3-70b-versatile"
    API_KEY_VAR = "GROQ_API_KEY"
else:  # openrouter (default)
    API_URL   = "https://openrouter.ai/api/v1/chat/completions"
    MODEL     = "meta-llama/llama-3.3-70b-instruct:free"
    API_KEY_VAR = "OPENROUTER_API_KEY"


def load_criteria() -> dict:
    with open(EVALS_FILE) as f:
        return json.load(f)


def build_system_prompt(criteria: dict) -> str:
    include_list = "\n".join(f"  - {x}" for x in criteria.get("include", []))
    exclude_list = "\n".join(f"  - {x}" for x in criteria.get("exclude", []))
    good = "\n".join(f"  ✓ {x}" for x in criteria.get("good_examples", []))
    bad  = "\n".join(f"  ✗ {x}" for x in criteria.get("bad_examples", []))
    fmt  = criteria.get("format_instructions", "")

    return f"""You extract AI-focused key takeaways from earnings call transcripts for a public markets dashboard.

INCLUDE takeaways about:
{include_list}

EXCLUDE (do not write takeaways about):
{exclude_list}

EXAMPLES OF GOOD TAKEAWAYS:
{good}

EXAMPLES OF BAD TAKEAWAYS (do not write these):
{bad}

FORMAT: {fmt}

Output only the numbered markdown list. No intro sentence, no outro, no headers — just the numbered takeaways starting at 1."""


def build_user_prompt(company_name: str, ticker: str, quarter: str, transcript: str) -> str:
    return f"""Earnings call: {company_name} ({ticker}), {quarter}

Transcript:
{transcript}"""


def call_llm(system: str, user: str, api_key: str) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if _PROVIDER == "openrouter":
        headers["HTTP-Referer"] = "https://github.com/IshiSin/PublicMarket_Scan"
        headers["X-Title"] = "AI Public Market Monitor"

    resp = httpx.post(
        API_URL,
        headers=headers,
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            "temperature": 0.3,
            "max_tokens":  2048,
        },
        timeout=90.0,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def generate_for(ticker: str, quarter: str, companies: list, api_key: str, criteria: dict):
    ticker_dir      = DATA_DIR / ticker
    event_file      = ticker_dir / f"{quarter}.json"
    transcript_file = ticker_dir / f"{quarter}-transcript.md"
    output_file     = ticker_dir / f"{quarter}-takeaways.md"

    if not event_file.exists():
        print(f"  ✗ No event file: {event_file}", file=sys.stderr)
        return False

    if not transcript_file.exists():
        print(f"  ✗ No transcript: {transcript_file}", file=sys.stderr)
        return False

    transcript = transcript_file.read_text(encoding="utf-8").strip()
    if not transcript:
        print(f"  ✗ Transcript is empty", file=sys.stderr)
        return False

    company_name = next((c["name"] for c in companies if c["ticker"] == ticker), ticker)

    print(f"  Generating takeaways for {ticker} {quarter}...")

    # Truncate to ~80k chars — Llama 3.3 70B has 128k context but keep headroom
    if len(transcript) > 80_000:
        transcript = transcript[:80_000] + "\n\n[Transcript truncated]"

    system = build_system_prompt(criteria)
    user   = build_user_prompt(company_name, ticker, quarter, transcript)

    try:
        content = call_llm(system, user, api_key)
    except httpx.HTTPStatusError as e:
        print(f"  ✗ API error {e.response.status_code}: {e.response.text}", file=sys.stderr)
        return False

    # Wrap in a clean header
    header = f"# {company_name} {quarter} — AI Key Takeaways\n\n"
    full   = header + content + "\n"

    output_file.write_text(full, encoding="utf-8")
    print(f"  ✓ Written: {output_file.relative_to(REPO_ROOT)}")
    return True


def find_all_pending(companies: list) -> list[tuple[str, str]]:
    """Return (ticker, quarter) pairs that have a transcript but no takeaways yet."""
    pending = []
    for company in companies:
        ticker    = company["ticker"]
        ticker_dir = DATA_DIR / ticker
        if not ticker_dir.exists():
            continue
        for tf in ticker_dir.glob("*-transcript.md"):
            quarter = tf.stem.replace("-transcript", "")
            out     = ticker_dir / f"{quarter}-takeaways.md"
            if not out.exists():
                pending.append((ticker, quarter))
    return pending


def main():
    api_key = os.environ.get(API_KEY_VAR)
    if not api_key:
        if _PROVIDER == "openrouter":
            print("Error: OPENROUTER_API_KEY not set. Get a free key at openrouter.ai", file=sys.stderr)
        else:
            print("Error: GROQ_API_KEY not set. Get a free key at console.groq.com", file=sys.stderr)
        sys.exit(1)
    print(f"Using {_PROVIDER} / {MODEL}")

    companies_file = REPO_ROOT / "data" / "companies.json"
    with open(companies_file) as f:
        companies = json.load(f)

    criteria = load_criteria()

    if "--all" in sys.argv:
        pairs = find_all_pending(companies)
        if not pairs:
            print("No transcripts missing takeaways.")
            return
        print(f"Processing {len(pairs)} transcript(s)...")
        for ticker, quarter in pairs:
            print(f"\n{ticker} {quarter}")
            generate_for(ticker, quarter, companies, api_key, criteria)
    else:
        if len(sys.argv) < 3:
            print("Usage: python generate_takeaways.py <TICKER> <QUARTER>", file=sys.stderr)
            print("       python generate_takeaways.py --all", file=sys.stderr)
            sys.exit(1)
        ticker  = sys.argv[1].upper()
        quarter = sys.argv[2]
        print(f"{ticker} {quarter}")
        ok = generate_for(ticker, quarter, companies, api_key, criteria)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
