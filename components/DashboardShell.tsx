"use client";

import { useEffect, useState } from "react";
import { useMarketData } from "./DataProvider";
import ThemeSection from "./ThemeSection";
import { SUB_THEME_ORDER, groupByTheme } from "@/lib/companies";
import type { CompanyData, Quote, Financials, NewsItem, EarningsEvent, Company } from "@/lib/types";

// Shape passed in from the server: static company info + pre-loaded events
export interface CompanyWithEvents {
  company: Company;
  events: EarningsEvent[];
}

interface Props {
  companiesWithEvents: CompanyWithEvents[];
}

function buildCompanyData(
  cwe: CompanyWithEvents,
  quotes: Record<string, Quote | { error: string }> | undefined,
  financials: Record<string, Financials | { error: string }> | undefined,
  news: Record<string, NewsItem[] | { error: string }> | undefined
): CompanyData {
  const { company, events } = cwe;
  const ticker = company.ticker;

  const quoteRaw = quotes?.[ticker];
  const finRaw = financials?.[ticker];
  const newsRaw = news?.[ticker];

  const quote = quoteRaw && !("error" in quoteRaw) ? (quoteRaw as Quote) : null;
  const fin = finRaw && !("error" in finRaw) ? (finRaw as Financials) : null;
  const newsItems = Array.isArray(newsRaw) ? (newsRaw as NewsItem[]) : [];

  return {
    company,
    quote,
    financials: fin,
    news: newsItems,
    events,
    errors: {
      quote: quoteRaw && "error" in quoteRaw ? (quoteRaw as { error: string }).error : undefined,
      financials: finRaw && "error" in finRaw ? (finRaw as { error: string }).error : undefined,
      news: newsRaw && !Array.isArray(newsRaw) && "error" in newsRaw ? (newsRaw as { error: string }).error : undefined,
    },
  };
}

export default function DashboardShell({ companiesWithEvents }: Props) {
  const { data, loading } = useMarketData();

  // Build a lookup map from ticker to CompanyWithEvents
  const cweByTicker = Object.fromEntries(
    companiesWithEvents.map((cwe) => [cwe.company.ticker, cwe])
  );

  const grouped = groupByTheme();

  // Ticker tape state — empty until data loads
  const [tickerTapeItems, setTickerTapeItems] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.quotes) return;
    const items = companiesWithEvents
      .map(({ company }) => {
        const q = data.quotes[company.ticker];
        if (!q || "error" in q) return null;
        const quote = q as Quote;
        const sign = (quote.day_change_pct ?? 0) >= 0 ? "▲" : "▼";
        return `${company.ticker} ${quote.price?.toFixed(2) ?? "—"} ${sign}${Math.abs(quote.day_change_pct ?? 0).toFixed(2)}%`;
      })
      .filter(Boolean) as string[];
    setTickerTapeItems(items);
  }, [data?.quotes, companiesWithEvents]);

  return (
    <>
      {/* ── Ticker Tape ───────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        height: "28px",
        display: "flex",
        alignItems: "center",
      }}>
        {tickerTapeItems.length > 0 ? (
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
        ) : (
          <span style={{
            fontSize: "10px",
            letterSpacing: "0.06em",
            color: "var(--text-faint)",
            padding: "0 20px",
          }}>
            {loading ? "LOADING MARKET DATA…" : "MARKET DATA UNAVAILABLE"}
          </span>
        )}
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "32px" }}>
        {SUB_THEME_ORDER.map((theme) => {
          const themeCompanies = grouped.get(theme) ?? [];
          const themeData = themeCompanies
            .map((c) => {
              const cwe = cweByTicker[c.ticker];
              if (!cwe) return null;
              return buildCompanyData(
                cwe,
                data?.quotes,
                data?.financials,
                data?.news
              );
            })
            .filter(Boolean) as CompanyData[];

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
    </>
  );
}
