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
      signal: AbortSignal.timeout(55000), // Render free tier can take ~30s to wake
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

  // Build ticker tape items from quotes
  const tickerTapeItems = companies
    .map((c) => {
      const q = quotesMap[c.ticker];
      if (!q || "error" in q) return null;
      const quote = q as Quote;
      const sign = (quote.day_change_pct ?? 0) >= 0 ? "▲" : "▼";
      return `${c.ticker} ${quote.price?.toFixed(2) ?? "—"} ${sign}${Math.abs(quote.day_change_pct ?? 0).toFixed(2)}%`;
    })
    .filter(Boolean) as string[];

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* ── Ticker Tape ─────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        height: "28px",
        display: "flex",
        alignItems: "center",
      }}>
        <div style={{
          display: "flex",
          whiteSpace: "nowrap",
          animation: "ticker 60s linear infinite",
          gap: "0",
        }}>
          {[...tickerTapeItems, ...tickerTapeItems].map((item, i) => (
            <span key={i} style={{
              fontSize: "10px",
              letterSpacing: "0.06em",
              color: item.includes("▲") ? "var(--pos)" : item.includes("▼") ? "var(--neg)" : "var(--text-dim)",
              padding: "0 20px",
              borderRight: "1px solid var(--border)",
            }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "28px",
            letterSpacing: "0.12em",
            color: "var(--primary)",
            textShadow: "var(--glow)",
            margin: 0,
          }}>
            AI PUBLIC MARKET MONITOR
          </h1>
          <span style={{ fontSize: "10px", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            {companies.length} COMPANIES · 6 THEMES
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            DATA AS OF
          </div>
          <div style={{ fontSize: "12px", color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
            {asOf}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "32px" }}>
        {SUB_THEME_ORDER.map((theme) => {
          const themeCompanies = grouped.get(theme) ?? [];
          const themeData = themeCompanies.map((c) => dataByTicker[c.ticker]).filter(Boolean);
          if (themeData.length === 0) return null;
          return <ThemeSection key={theme} theme={theme} companies={themeData} />;
        })}

        <footer style={{
          marginTop: "48px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border)",
          fontSize: "10px",
          color: "var(--text-faint)",
          letterSpacing: "0.06em",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}>
          <span>DATA · YAHOO FINANCE · SEC EDGAR · TRANSCRIPTS MANUALLY CURATED</span>
          <span>NOT FINANCIAL ADVICE</span>
        </footer>
      </main>
    </div>
  );
}
