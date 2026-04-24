import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { companies } from "@/lib/companies";
import type { Quote, Financials, NewsItem } from "@/lib/types";

const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

async function fetchQuotes(): Promise<Record<string, Quote | { error: string }>> {
  const tickers = companies.map((c) => c.ticker).join(",");
  const cacheKey = `quotes:${companies.map((c) => c.ticker).sort().join(",")}`;

  const cached = await cacheGet<Record<string, Quote>>(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${BACKEND}/quotes?tickers=${encodeURIComponent(tickers)}`,
      { signal: AbortSignal.timeout(55000) }
    );
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    await cacheSet(cacheKey, data, 60);
    return data;
  } catch (e) {
    return Object.fromEntries(companies.map((c) => [c.ticker, { error: String(e) }]));
  }
}

async function fetchAllFinancials(): Promise<Record<string, Financials | { error: string }>> {
  const results: Record<string, Financials | { error: string }> = {};
  const missing: string[] = [];

  for (const c of companies) {
    const cached = await cacheGet<Financials>(`financials:v2:${c.ticker}`);
    if (cached) results[c.ticker] = cached;
    else missing.push(c.ticker);
  }

  if (missing.length === 0) return results;

  try {
    const resp = await fetch(
      `${BACKEND}/financials/batch?tickers=${encodeURIComponent(missing.join(","))}`,
      { signal: AbortSignal.timeout(55000) }
    );
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data: Record<string, Financials> = await resp.json();
    for (const [ticker, fin] of Object.entries(data)) {
      if (!("error" in fin)) await cacheSet(`financials:v2:${ticker}`, fin, 86400);
      results[ticker] = fin;
    }
  } catch (e) {
    for (const ticker of missing) results[ticker] = { error: String(e) };
  }

  return results;
}

async function fetchAllNews(): Promise<Record<string, NewsItem[] | { error: string }>> {
  const results: Record<string, NewsItem[] | { error: string }> = {};
  const missingTickers: string[] = [];
  const missingNames: string[] = [];

  for (const c of companies) {
    const cached = await cacheGet<NewsItem[]>(`news:${c.ticker}`);
    if (cached) results[c.ticker] = cached;
    else {
      missingTickers.push(c.ticker);
      missingNames.push(c.name);
    }
  }

  if (missingTickers.length === 0) return results;

  try {
    const resp = await fetch(
      `${BACKEND}/news/batch?tickers=${encodeURIComponent(missingTickers.join(","))}&names=${encodeURIComponent(missingNames.join(","))}`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data: Record<string, NewsItem[]> = await resp.json();
    for (const [ticker, items] of Object.entries(data)) {
      if (Array.isArray(items)) await cacheSet(`news:${ticker}`, items, 86400);
      results[ticker] = items;
    }
  } catch (e) {
    for (const ticker of missingTickers) results[ticker] = { error: String(e) };
  }

  return results;
}

export const dynamic = "force-dynamic";
// Allow backend warm-up time; this route is called client-side so it won't cause SSR 504s
export const maxDuration = 60;

export async function GET() {
  // Quotes first (sequential to avoid overwhelming Render free tier), then financials + news in parallel
  const quotes = await fetchQuotes();
  const [financials, news] = await Promise.all([fetchAllFinancials(), fetchAllNews()]);

  return NextResponse.json({ quotes, financials, news });
}
