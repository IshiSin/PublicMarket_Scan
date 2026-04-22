"use client";

import type { CompanyData } from "@/lib/types";
import PriceBlock from "./PriceBlock";
import FinancialsBlock from "./FinancialsBlock";
import NewsBlock from "./NewsBlock";
import EarningsTimeline from "./EarningsTimeline";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: "9px", letterSpacing: "0.14em", color: "var(--primary-dim)",
        marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px",
      }}>
        <span>{label}</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      </div>
      {children}
    </div>
  );
}

export default function CompanyCard({ data }: { data: CompanyData }) {
  const { company, quote, financials, news, events, errors } = data;

  return (
    <div
      className="fade-up"
      style={{
        background: "var(--surface)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "14px",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border-hi)";
        el.style.boxShadow = "0 0 20px rgba(173,255,47,0.06)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg, var(--primary) 0%, transparent 100%)",
        opacity: 0.5,
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px", letterSpacing: "0.06em",
            color: "var(--primary)", textShadow: "var(--glow-sm)",
            lineHeight: 1,
          }}>
            {company.ticker}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px", lineHeight: 1.3 }}>
            {company.name}
          </div>
        </div>
        <div style={{
          fontSize: "9px", letterSpacing: "0.1em",
          color: "var(--text-faint)",
          border: "1px solid var(--border)",
          padding: "2px 5px",
        }}>
          {company.exchange}
        </div>
      </div>

      {/* Price */}
      <PriceBlock quote={quote} error={errors.quote} />

      {/* Financials */}
      <Section label="FINANCIALS">
        <FinancialsBlock financials={financials} error={errors.financials} />
      </Section>

      {/* News */}
      <Section label="NEWS">
        <NewsBlock news={news} error={errors.news} />
      </Section>

      {/* Earnings */}
      <Section label="EARNINGS">
        <EarningsTimeline events={events} irUrl={company.ir_url} error={errors.events} />
      </Section>
    </div>
  );
}
