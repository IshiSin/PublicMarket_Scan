"use client";

import type { Financials } from "@/lib/types";

function fmtRev(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Row({ label, value, colored }: { label: string; value: string; colored?: number | null }) {
  const color = colored != null
    ? colored >= 0 ? "var(--pos)" : "var(--neg)"
    : "var(--text)";
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "3px 0", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ color: "var(--text-dim)", fontSize: "10px", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ color, fontSize: "11px" }}>{value}</span>
    </div>
  );
}

export default function FinancialsBlock({ financials, error }: { financials: Financials | null; error?: string }) {
  if (error) return (
    <div style={{ color: "var(--text-faint)", fontSize: "11px", padding: "8px 0" }}>
      FINANCIALS UNAVAILABLE
    </div>
  );
  if (!financials) return (
    <div style={{ color: "var(--text-faint)", fontSize: "11px", padding: "8px 0" }}>
      LOADING<span className="cursor" />
    </div>
  );

  return (
    <div>
      <Row label="REV ANNUAL"    value={fmtRev(financials.revenue_annual)} />
      <Row label="REV MRQ"       value={fmtRev(financials.revenue_latest_q)} />
      <Row label="REV YOY"       value={fmtPct(financials.revenue_yoy_pct)}   colored={financials.revenue_yoy_pct} />
      <Row label="NET INCOME MRQ" value={fmtRev(financials.net_income_mrq)} colored={financials.net_income_mrq} />
      <Row label="GROSS MARGIN"   value={fmtPct(financials.gross_margin)} />
      <Row label="P/E (TTM)"      value={financials.pe_ratio != null ? `${financials.pe_ratio.toFixed(1)}x` : "—"} />
      <Row label="CAPEX TTM"     value={fmtRev(financials.capex_ttm)} />
      <Row label="NEXT EARNINGS" value={fmtDate(financials.next_earnings_date)} />
    </div>
  );
}
