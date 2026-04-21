"use client";

import type { Quote } from "@/lib/types";

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCap(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function PctBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-neutral-500">—</span>;
  const pos = pct >= 0;
  return (
    <span className={pos ? "text-emerald-400" : "text-red-400"}>
      {pos ? "+" : ""}
      {fmt(pct)}%
    </span>
  );
}

interface Props {
  quote: Quote | null;
  error?: string;
}

export default function PriceBlock({ quote, error }: Props) {
  if (error) {
    return (
      <div className="text-xs text-neutral-500 border border-neutral-800 rounded px-3 py-2">
        Price unavailable
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="text-xs text-neutral-600 border border-neutral-800 rounded px-3 py-2 animate-pulse">
        Loading…
      </div>
    );
  }

  return (
    <div className="border border-neutral-800 rounded px-3 py-2 space-y-1">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold text-white">${fmt(quote.price)}</span>
        <PctBadge pct={quote.day_change_pct} />
        <span className="text-neutral-500 text-xs">today</span>
      </div>
      <div className="flex gap-4 text-xs text-neutral-400">
        <span>
          YTD <PctBadge pct={quote.ytd_pct} />
        </span>
        <span>MCap {fmtCap(quote.market_cap)}</span>
      </div>
    </div>
  );
}
