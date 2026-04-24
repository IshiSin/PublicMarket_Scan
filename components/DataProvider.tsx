"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Quote, Financials, NewsItem } from "@/lib/types";

export interface MarketData {
  quotes: Record<string, Quote | { error: string }>;
  financials: Record<string, Financials | { error: string }>;
  news: Record<string, NewsItem[] | { error: string }>;
}

interface MarketDataContextValue {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
}

const MarketDataContext = createContext<MarketDataContextValue>({
  data: null,
  loading: true,
  error: null,
});

export function useMarketData(): MarketDataContextValue {
  return useContext(MarketDataContext);
}

export default function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const resp = await fetch("/api/market-data");
        if (!resp.ok) throw new Error(`API returned ${resp.status}`);
        const json: MarketData = await resp.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <MarketDataContext.Provider value={{ data, loading, error }}>
      {children}
    </MarketDataContext.Provider>
  );
}
