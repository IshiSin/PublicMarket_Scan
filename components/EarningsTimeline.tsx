"use client";

import { useState } from "react";
import type { EarningsEvent } from "@/lib/types";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(n: number | null, prefix = ""): string {
  if (n == null) return "—";
  return `${prefix}${n.toFixed(2)}`;
}

function BeatMiss({ actual, estimate }: { actual: number | null; estimate: number | null }) {
  if (actual == null || estimate == null) return <span className="text-neutral-500">—</span>;
  const beat = actual >= estimate;
  return (
    <span className={beat ? "text-emerald-400" : "text-red-400"}>
      {beat ? "Beat" : "Miss"}
    </span>
  );
}

function StatusBadge({ status, irUrl }: { status: string; irUrl: string }) {
  const styles: Record<string, string> = {
    published: "bg-emerald-900 text-emerald-300",
    pending: "bg-yellow-900 text-yellow-300",
    unavailable: "bg-neutral-800 text-neutral-400",
  };
  const labels: Record<string, string> = {
    published: "Transcript",
    pending: "Pending",
    unavailable: "Unavailable",
  };
  if (status === "pending" || status === "unavailable") {
    return (
      <a href={irUrl} target="_blank" rel="noopener noreferrer">
        <span className={`text-xs px-1.5 py-0.5 rounded ${styles[status]}`}>
          {labels[status]}
        </span>
      </a>
    );
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function SummarySection({ summary }: { summary: NonNullable<EarningsEvent["ai_summary"]> }) {
  const sections = [
    { key: "ai_revenue_mentions" as const, label: "AI Revenue" },
    { key: "capex_guidance" as const, label: "CapEx Guidance" },
    { key: "gpu_supply_commentary" as const, label: "GPU Supply" },
    { key: "data_center_plans" as const, label: "Data Centers" },
    { key: "other_notable" as const, label: "Other Notable" },
  ];

  return (
    <div className="mt-2 space-y-2 text-xs border-t border-neutral-800 pt-2">
      {sections.map(({ key, label }) => {
        const quotes = summary[key];
        if (!quotes || quotes.length === 0) return null;
        return (
          <div key={key}>
            <div className="text-neutral-500 mb-1">{label}</div>
            <ul className="space-y-1">
              {quotes.map((q, i) => (
                <li key={i} className="text-neutral-300 italic border-l border-neutral-700 pl-2">
                  &ldquo;{q}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  events: EarningsEvent[];
  irUrl: string;
  error?: string;
}

export default function EarningsTimeline({ events, irUrl, error }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (error) {
    return (
      <div className="text-xs text-neutral-500 border border-neutral-800 rounded px-3 py-2">
        Earnings data unavailable
      </div>
    );
  }
  if (!events || events.length === 0) {
    return (
      <div className="text-xs text-neutral-700 border border-neutral-800 rounded px-3 py-2">
        No earnings events recorded yet
      </div>
    );
  }

  return (
    <div className="border border-neutral-800 rounded divide-y divide-neutral-800">
      {events.slice(0, 4).map((ev) => {
        const key = `${ev.ticker}-${ev.fiscal_quarter}`;
        const isExpanded = expanded === key;

        return (
          <div key={key} className="px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-medium">{ev.fiscal_quarter}</span>
                <span className="text-neutral-600">{fmtDate(ev.report_date)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-neutral-500">
                  EPS {fmtNum(ev.eps_actual)} / est {fmtNum(ev.eps_estimate)}{" "}
                  <BeatMiss actual={ev.eps_actual} estimate={ev.eps_estimate} />
                </span>
                <StatusBadge status={ev.transcript_status} irUrl={irUrl} />
                {ev.transcript_status === "published" && ev.ai_summary && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : key)}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors underline"
                  >
                    {isExpanded ? "hide" : "AI notes"}
                  </button>
                )}
              </div>
            </div>
            {isExpanded && ev.ai_summary && <SummarySection summary={ev.ai_summary} />}
          </div>
        );
      })}
    </div>
  );
}
