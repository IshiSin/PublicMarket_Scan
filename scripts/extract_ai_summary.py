#!/usr/bin/env python3
"""
Extract AI-relevant quotes from an earnings transcript using Claude.
Usage: python extract_ai_summary.py <TICKER> <FISCAL_QUARTER>
  e.g. python extract_ai_summary.py NVDA 2025-Q3
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

import anthropic

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data" / "events"

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """You are analyzing an earnings call transcript. Extract direct quotes that are relevant to AI.
Return ONLY valid JSON — no prose, no markdown fences."""

def build_user_prompt(company_name: str, ticker: str, quarter: str, transcript: str) -> str:
    return f"""You are analyzing an earnings call transcript for {company_name} ({ticker}), {quarter}.
Extract quotes relevant to AI. Return JSON with these keys, each an array of direct quotes from the transcript:

- ai_revenue_mentions: statements about AI-driven revenue, AI product revenue, or AI customer demand
- capex_guidance: statements about capital expenditure plans, data center buildout, infrastructure investment
- gpu_supply_commentary: statements about GPU availability, supply constraints, allocation, vendor relationships
- data_center_plans: statements about data center expansion, power, siting, capacity
- other_notable: anything else AI-relevant that doesn't fit the above buckets

Use direct quotes only, not paraphrases. Preserve attribution (who said it — CEO, CFO, analyst name).
If a category has no relevant content, return an empty array.

Transcript:
{transcript}"""


def main():
    if len(sys.argv) < 3:
        print("Usage: python extract_ai_summary.py <TICKER> <FISCAL_QUARTER>", file=sys.stderr)
        sys.exit(1)

    ticker = sys.argv[1].upper()
    quarter = sys.argv[2]

    ticker_dir = DATA_DIR / ticker
    event_file = ticker_dir / f"{quarter}.json"
    transcript_file = ticker_dir / f"{quarter}-transcript.md"

    if not event_file.exists():
        print(f"Event file not found: {event_file}", file=sys.stderr)
        sys.exit(1)

    if not transcript_file.exists():
        print(f"Transcript file not found: {transcript_file}", file=sys.stderr)
        sys.exit(1)

    with open(event_file) as f:
        event = json.load(f)

    transcript_text = transcript_file.read_text(encoding="utf-8")
    if not transcript_text.strip():
        print("Transcript file is empty.", file=sys.stderr)
        sys.exit(1)

    # Look up company name from companies.json
    companies_file = REPO_ROOT / "data" / "companies.json"
    with open(companies_file) as f:
        companies = json.load(f)
    company_name = next((c["name"] for c in companies if c["ticker"] == ticker), ticker)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    print(f"Extracting AI summary for {ticker} {quarter}...")

    # Truncate transcript to ~100k chars to stay within token limits
    truncated = transcript_text[:100_000]
    if len(transcript_text) > 100_000:
        truncated += "\n\n[Transcript truncated for length]"

    message = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": build_user_prompt(company_name, ticker, quarter, truncated),
            }
        ],
    )

    raw_json = message.content[0].text.strip()

    # Strip markdown fences if model added them anyway
    if raw_json.startswith("```"):
        lines = raw_json.split("\n")
        raw_json = "\n".join(lines[1:-1])

    try:
        summary = json.loads(raw_json)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON response: {e}\nResponse:\n{raw_json}", file=sys.stderr)
        sys.exit(1)

    # Validate keys
    expected_keys = {
        "ai_revenue_mentions",
        "capex_guidance",
        "gpu_supply_commentary",
        "data_center_plans",
        "other_notable",
    }
    for key in expected_keys:
        if key not in summary:
            summary[key] = []

    # Write summary file
    summary_file = ticker_dir / f"{quarter}-summary.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Written: {summary_file.name}")

    # Update event JSON
    event["ai_summary"] = summary
    with open(event_file, "w") as f:
        json.dump(event, f, indent=2)
    print(f"Updated: {event_file.name}")

    print("Done.")


if __name__ == "__main__":
    main()
