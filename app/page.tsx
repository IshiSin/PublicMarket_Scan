import { companies, groupByTheme, SUB_THEME_ORDER } from "@/lib/companies";
import { cacheGet, cacheSet } from "@/lib/cache";
import ThemeSection from "@/components/ThemeSection";
import type { CompanyData, Quote, Financials, NewsItem, EarningsEvent } from "@/lib/types";
import { promises as fs } from "fs";
import path from "path";

// Force dynamic rendering so data refreshes on each page load
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

async function fetchQuotes(): Promise<Record<string, Quote | { error: string }>> {
  const tickers = companies.map((c) => c.ticker).join(",");
  const cacheKey = `quotes:${companies.map((c) => c.ticker).sort().join(",")}`;

  const cached = await cacheGet<Record<string, Quote>>(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(`${BACKEND}/quotes?tickers=${encodeURIComponent(tickers)}`, {
      signal: AbortSignal.timeout(25000),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    await cacheSet(cacheKey, data, 60);
    return data;
  } catch (e) {
    return Object.fromEntries(companies.map((c) => [c.ticker, { error: String(e) }]));
  }
}

async function fetchFinancials(ticker: string): Promise<Financials | { error: string }> {
  const cacheKey = `financials:${ticker}`;
  const cached = await cacheGet<Financials>(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(`${BACKEND}/financials?ticker=${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    await cacheSet(cacheKey, data, 86400);
    return data;
  } catch (e) {
    return { error: String(e) };
  }
}

async function fetchNews(ticker: string): Promise<NewsItem[] | { error: string }> {
  const cacheKey = `news:${ticker}`;
  const cached = await cacheGet<NewsItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(`${BACKEND}/news?ticker=${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    await cacheSet(cacheKey, data, 900);
    return data;
  } catch (e) {
    return { error: String(e) };
  }
}

async function fetchEvents(ticker: string): Promise<EarningsEvent[]> {
  const dir = path.join(process.cwd(), "data", "events", ticker);
  try {
    const files = await fs.readdir(dir);
    const eventFiles = files
      .filter((f) => f.endsWith(".json") && !f.includes("summary") && !f.includes("transcript"))
      .sort()
      .reverse()
      .slice(0, 4);

    const events: EarningsEvent[] = [];
    for (const file of eventFiles) {
      try {
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        events.push(JSON.parse(raw));
      } catch {
        // skip malformed
      }
    }
    return events;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const asOf = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // Fetch quotes first (batch), then financials/news/events per-ticker in parallel
  const quotesMap = await fetchQuotes();

  const perTickerData = await Promise.all(
    companies.map(async (company) => {
      const [financialsResult, newsResult, events] = await Promise.all([
        fetchFinancials(company.ticker),
        fetchNews(company.ticker),
        fetchEvents(company.ticker),
      ]);

      const quoteResult = quotesMap[company.ticker];

        const companyData: CompanyData = {
          company,
          quote: quoteResult && !("error" in quoteResult) ? (quoteResult as Quote) : null,
          financials:
            financialsResult && !("error" in financialsResult) ? (financialsResult as Financials) : null,
          news: Array.isArray(newsResult) ? (newsResult as NewsItem[]) : [],
          events,
          errors: {
            quote: quoteResult && "error" in quoteResult ? (quoteResult as { error: string }).error : undefined,
            financials:
              financialsResult && "error" in financialsResult
                ? (financialsResult as { error: string }).error
                : undefined,
            news: newsResult && "error" in newsResult ? (newsResult as { error: string }).error : undefined,
          },
        };

        return { ticker: company.ticker, data: companyData };
      })
  );

  const dataByTicker = Object.fromEntries(perTickerData.map(({ ticker, data }) => [ticker, data]));
  const grouped = groupByTheme();

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">AI Market Map</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            28 publicly listed companies across the AI ecosystem
          </p>
        </div>
        <div className="text-xs text-neutral-600">Data as of {asOf}</div>
      </div>

      {/* Themed sections */}
      {SUB_THEME_ORDER.map((theme) => {
        const themeCompanies = grouped.get(theme) ?? [];
        const themeData = themeCompanies.map((c) => dataByTicker[c.ticker]).filter(Boolean);
        if (themeData.length === 0) return null;
        return <ThemeSection key={theme} theme={theme} companies={themeData} />;
      })}

      <footer className="text-xs text-neutral-700 text-center pt-8 border-t border-neutral-800 mt-4">
        Data sourced from Yahoo Finance (prices, news) and SEC EDGAR. Not financial advice.
        Transcripts manually curated.
      </footer>
    </main>
  );
}
