"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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

function parseTakeaways(md: string): { bold: string; rest: string }[] {
  const items: { bold: string; rest: string }[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*(.*)$/);
    if (m) items.push({ bold: m[1], rest: m[2].trim() });
  }
  return items;
}

function TakeawaysModal({
  md, title, onClose,
}: { md: string; title: string; onClose: () => void }) {
  const items = parseTakeaways(md);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(4, 6, 4, 0.88)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-hi)",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 60px rgba(173,255,47,0.08)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px", letterSpacing: "0.1em",
              color: "var(--primary)", textShadow: "var(--glow-sm)",
            }}>
              {title}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "2px", letterSpacing: "0.08em" }}>
              AI-FOCUSED KEY TAKEAWAYS
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-dim)", cursor: "pointer",
              fontSize: "12px", padding: "4px 10px",
              letterSpacing: "0.06em",
            }}
          >
            ESC ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "24px 28px", flex: 1 }}>
          {items.length > 0 ? (
            <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {items.map((item, i) => (
                <li key={i} style={{ lineHeight: 1.7, color: "var(--text-dim)", fontSize: "13px" }}>
                  <span style={{
                    color: "var(--text)", fontWeight: 600,
                    fontFamily: "var(--font-display)",
                    fontSize: "15px", letterSpacing: "0.02em",
                  }}>
                    {item.bold}
                  </span>
                  {item.rest && (
                    <span style={{ display: "block", marginTop: "2px", fontSize: "12px" }}>
                      {item.rest}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <pre style={{ fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" }}>{md}</pre>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border)",
          fontSize: "9px", color: "var(--text-faint)", letterSpacing: "0.08em",
          flexShrink: 0,
        }}>
          GENERATED BY AI · NOT FINANCIAL ADVICE · CLICK OUTSIDE OR ESC TO CLOSE
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function EarningsTimeline({
  events, irUrl, error,
}: { events: EarningsEvent[]; irUrl: string; error?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [takeawaysKey, setTakeawaysKey] = useState<string | null>(null);

  if (error || !events?.length) return (
    <div style={{ color: "var(--text-faint)", fontSize: "10px" }}>
      {error ? "EARNINGS UNAVAILABLE" : "NO EVENTS RECORDED"}
    </div>
  );

  const activeEvent = takeawaysKey ? events.find(e => `${e.ticker}-${e.fiscal_quarter}` === takeawaysKey) : null;

  return (
    <>
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
                  {/* Status badge */}
                  <a
                    href={
                      ev.transcript_status === "published" && ev.transcript_source_url
                        ? ev.transcript_source_url
                        : irUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
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

                  {/* Takeaways — opens full-screen modal */}
                  {ev.takeaways_md && (
                    <button
                      onClick={() => setTakeawaysKey(key)}
                      style={{
                        fontSize: "9px", letterSpacing: "0.06em",
                        padding: "2px 6px",
                        background: "rgba(173,255,47,0.06)",
                        color: "var(--primary)",
                        border: "1px solid var(--border-hi)",
                        cursor: "pointer",
                      }}
                    >
                      ▤ TAKEAWAYS
                    </button>
                  )}

                  {/* AI Notes toggle */}
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

      {/* Full-screen takeaways modal */}
      {activeEvent?.takeaways_md && (
        <TakeawaysModal
          md={activeEvent.takeaways_md}
          title={`${activeEvent.ticker} ${activeEvent.fiscal_quarter}`}
          onClose={() => setTakeawaysKey(null)}
        />
      )}
    </>
  );
}
