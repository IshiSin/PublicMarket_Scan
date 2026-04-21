"use client";

import { useState } from "react";
import type { EarningsEvent } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function Beat({ actual, estimate }: { actual: number | null; estimate: number | null }) {
  if (actual == null || estimate == null) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const beat = actual >= estimate;
  return <span style={{ color: beat ? "var(--pos)" : "var(--neg)" }}>{beat ? "BEAT" : "MISS"}</span>;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  published:   { bg: "rgba(57,211,83,0.12)",   color: "var(--pos)", label: "TRANSCRIPT" },
  pending:     { bg: "rgba(173,255,47,0.08)",   color: "var(--primary)", label: "PENDING" },
  unavailable: { bg: "rgba(194,212,188,0.05)",  color: "var(--text-faint)", label: "N/A" },
};

function SummarySection({ summary }: { summary: NonNullable<EarningsEvent["ai_summary"]> }) {
  const sections = [
    { key: "ai_revenue_mentions" as const,    label: "AI REVENUE" },
    { key: "capex_guidance" as const,         label: "CAPEX" },
    { key: "gpu_supply_commentary" as const,  label: "GPU SUPPLY" },
    { key: "data_center_plans" as const,      label: "DATA CENTERS" },
    { key: "other_notable" as const,          label: "OTHER" },
  ];
  return (
    <div style={{
      marginTop: "10px", paddingTop: "10px",
      borderTop: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: "10px",
    }}>
      {sections.map(({ key, label }) => {
        const quotes = summary[key];
        if (!quotes?.length) return null;
        return (
          <div key={key}>
            <div style={{ fontSize: "9px", letterSpacing: "0.12em", color: "var(--primary-dim)", marginBottom: "4px" }}>
              {label}
            </div>
            {quotes.map((q, i) => (
              <div key={i} style={{
                fontSize: "10px", lineHeight: "1.5",
                color: "var(--text-dim)",
                paddingLeft: "8px",
                borderLeft: "1px solid var(--border-hi)",
                marginBottom: "4px",
                fontStyle: "italic",
              }}>
                "{q}"
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function EarningsTimeline({
  events, irUrl, error,
}: { events: EarningsEvent[]; irUrl: string; error?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (error || !events?.length) return (
    <div style={{ color: "var(--text-faint)", fontSize: "10px" }}>
      {error ? "EARNINGS UNAVAILABLE" : "NO EVENTS RECORDED"}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      {events.slice(0, 4).map((ev) => {
        const key = `${ev.ticker}-${ev.fiscal_quarter}`;
        const isExp = expanded === key;
        const st = STATUS_STYLES[ev.transcript_status] ?? STATUS_STYLES.unavailable;

        return (
          <div key={key} style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "6px 8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "var(--primary)", letterSpacing: "0.04em" }}>
                  {ev.fiscal_quarter}
                </span>
                <span style={{ fontSize: "9px", color: "var(--text-faint)" }}>
                  {fmtDate(ev.report_date)}
                </span>
                <Beat actual={ev.eps_actual} estimate={ev.eps_estimate} />
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {/* Status badge — clickable link for all states */}
                <a
                  href={
                    ev.transcript_status === "published" && ev.transcript_source_url
                      ? ev.transcript_source_url
                      : irUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                  title={
                    ev.transcript_status === "published" && ev.transcript_source_url
                      ? "View transcript source"
                      : "View investor relations page"
                  }
                >
                  <span style={{
                    fontSize: "9px", letterSpacing: "0.08em",
                    padding: "2px 6px", background: st.bg, color: st.color,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textDecorationStyle: "dotted",
                  }}>
                    {st.label} ↗
                  </span>
                </a>

                {/* AI Notes toggle — only when summary exists */}
                {ev.transcript_status === "published" && ev.ai_summary && (
                  <button
                    onClick={() => setExpanded(isExp ? null : key)}
                    style={{
                      fontSize: "9px", letterSpacing: "0.06em",
                      padding: "2px 6px",
                      background: isExp ? "rgba(173,255,47,0.15)" : "rgba(173,255,47,0.06)",
                      color: "var(--primary)",
                      border: "1px solid var(--border-hi)",
                      cursor: "pointer",
                    }}
                  >
                    {isExp ? "▲ HIDE" : "▼ AI NOTES"}
                  </button>
                )}
              </div>
            </div>
            {isExp && ev.ai_summary && <SummarySection summary={ev.ai_summary} />}
          </div>
        );
      })}
    </div>
  );
}
