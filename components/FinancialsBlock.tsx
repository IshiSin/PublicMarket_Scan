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
  const pos = n >= 0;
  return `${pos ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  financials: Financials | null;
  error?: string;
}

export default function FinancialsBlock({ financials, error }: Props) {
  if (error) {
    return (
      <div className="text-xs text-neutral-500 border border-neutral-800 rounded px-3 py-2">
        Financials unavailable
      </div>
    );
  }
  if (!financials) {
    return (
      <div className="text-xs text-neutral-600 border border-neutral-800 rounded px-3 py-2 animate-pulse">
        Loading…
      </div>
    );
  }

  const rows = [
    { label: "Revenue (MRQ)", value: fmtRev(financials.revenue_latest_q) },
    {
      label: "Rev YoY",
      value: fmtPct(financials.revenue_yoy_pct),
      colored: financials.revenue_yoy_pct,
    },
    { label: "Gross Margin", value: fmtPct(financials.gross_margin) },
    { label: "CapEx TTM", value: fmtRev(financials.capex_ttm) },
    {
      label: "CapEx YoY",
      value: fmtPct(financials.capex_yoy_pct),
      colored: financials.capex_yoy_pct,
    },
    { label: "Next Earnings", value: fmtDate(financials.next_earnings_date) },
  ];

  return (
    <div className="border border-neutral-800 rounded px-3 py-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {rows.map(({ label, value, colored }) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-neutral-500">{label}</span>
            <span
              className={
                colored !== undefined
                  ? colored != null && colored >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                  : "text-neutral-200"
              }
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
