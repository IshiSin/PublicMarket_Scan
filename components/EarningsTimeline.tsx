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
    if (m) items.push({ bold: m[1], rest: m[2].replace(/^[,;:\s]+/, "") });
  }
  return items;
}

function TakeawaysModal({
  md, title, onClose,
}: { md: string; title: string; onClose: () => void }) {
  const items = parseTakeaways(md);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const [ticker, quarter] = title.split(" ");

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(2, 4, 2, 0.92)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0A0D0A",
          border: "1px solid rgba(173,255,47,0.30)",
          width: "100%",
          maxWidth: "780px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 0 1px rgba(173,255,47,0.06), 0 32px 80px rgba(0,0,0,0.8), 0 0 80px rgba(173,255,47,0.06)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(173,255,47,0.8) 20%, rgba(173,255,47,1) 50%, rgba(173,255,47,0.8) 80%, transparent)",
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "20px 28px 16px",
          borderBottom: "1px solid rgba(173,255,47,0.10)",
          flexShrink: 0,
          gap: "16px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#ADFF2F",
                textShadow: "0 0 16px rgba(173,255,47,0.5)",
                lineHeight: 1,
              }}>
                {ticker}
              </span>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 400,
                letterSpacing: "0.08em",
                color: "rgba(173,255,47,0.55)",
                lineHeight: 1,
              }}>
                {quarter}
              </span>
            </div>
            <div style={{
              marginTop: "6px",
              fontSize: "11px",
              letterSpacing: "0.15em",
              color: "rgba(194,212,188,0.40)",
              textTransform: "uppercase",
            }}>
              AI-Focused Key Takeaways · {items.length} Items
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(173,255,47,0.05)",
              border: "1px solid rgba(173,255,47,0.20)",
              color: "rgba(173,255,47,0.60)",
              cursor: "pointer",
              fontSize: "11px",
              padding: "6px 14px",
              letterSpacing: "0.10em",
              flexShrink: 0,
              transition: "all 0.15s ease",
              fontFamily: "var(--font-mono), monospace",
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = "rgba(173,255,47,0.12)";
              (e.target as HTMLButtonElement).style.color = "#ADFF2F";
              (e.target as HTMLButtonElement).style.borderColor = "rgba(173,255,47,0.45)";
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = "rgba(173,255,47,0.05)";
              (e.target as HTMLButtonElement).style.color = "rgba(173,255,47,0.60)";
              (e.target as HTMLButtonElement).style.borderColor = "rgba(173,255,47,0.20)";
            }}
          >
            ESC ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "12px 0", flex: 1 }}>
          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr",
                    borderBottom: "1px solid rgba(173,255,47,0.07)",
                    padding: "0",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(173,255,47,0.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* Number column */}
                  <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: "20px",
                    paddingBottom: "20px",
                    borderRight: "1px solid rgba(173,255,47,0.07)",
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "22px",
                      fontWeight: 700,
                      color: "rgba(173,255,47,0.40)",
                      textShadow: "none",
                      lineHeight: 1,
                      letterSpacing: "-0.01em",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Content column */}
                  <div style={{ padding: "18px 24px 18px 22px" }}>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "17px",
                      fontWeight: 600,
                      letterSpacing: "0.01em",
                      color: "#C2D4BC",
                      lineHeight: 1.3,
                      marginBottom: item.rest ? "8px" : 0,
                    }}>
                      {item.bold}
                    </div>
                    {item.rest && (
                      <div style={{
                        fontSize: "13px",
                        lineHeight: 1.7,
                        color: "rgba(194,212,188,0.70)",
                        fontFamily: "var(--font-mono), monospace",
                      }}>
                        {item.rest}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <pre style={{
              fontSize: "13px",
              color: "rgba(194,212,188,0.70)",
              whiteSpace: "pre-wrap",
              margin: 0,
              padding: "20px 28px",
              lineHeight: 1.7,
            }}>{md}</pre>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 28px",
          borderTop: "1px solid rgba(173,255,47,0.10)",
          fontSize: "10px",
          color: "rgba(194,212,188,0.25)",
          letterSpacing: "0.10em",
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>GENERATED BY AI · NOT FINANCIAL ADVICE</span>
          <span>CLICK OUTSIDE OR ESC TO CLOSE</span>
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
