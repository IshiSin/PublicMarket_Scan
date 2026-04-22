"use client";

import type { Quote } from "@/lib/types";

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtCap(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function Pct({ v }: { v: number | null | undefined }) {
  if (v == null) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const pos = v >= 0;
  return (
    <span style={{ color: pos ? "var(--pos)" : "var(--neg)" }}>
      {pos ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%
    </span>
  );
}

export default function PriceBlock({ quote, error }: { quote: Quote | null; error?: string }) {
  if (error) return (
    <div className="price-block unavail">
      <span style={{ color: "var(--text-faint)" }}>PRICE UNAVAILABLE</span>
    </div>
  );

  if (!quote) return (
    <div className="price-block loading">
      <span style={{ color: "var(--text-faint)" }}>FETCHING</span>
      <span className="cursor" />
    </div>
  );

  return (
    <div className="price-block">
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: "28px",
          letterSpacing: "0.02em",
          color: "var(--primary)",
          textShadow: "var(--glow)",
          lineHeight: 1,
        }}>
          ${fmt(quote.price)}
        </span>
        <span style={{ fontSize: "12px" }}><Pct v={quote.day_change_pct} /></span>
      </div>
      <div style={{
        display: "flex", gap: "16px", marginTop: "6px",
        fontSize: "11px", color: "var(--text-dim)",
      }}>
        <span>YTD <Pct v={quote.ytd_pct} /></span>
        <span style={{ color: "var(--border-hi)" }}>│</span>
        <span>MCAP <span style={{ color: "var(--text)" }}>{fmtCap(quote.market_cap)}</span></span>
      </div>
    </div>
  );
}
