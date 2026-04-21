"use client";

import type { CompanyData, SubTheme } from "@/lib/types";
import { SUB_THEME_LABELS } from "@/lib/companies";
import CompanyCard from "./CompanyCard";

const THEME_CODES: Record<SubTheme, string> = {
  hyperscalers:       "01",
  neoclouds:          "02",
  semis_compute:      "03",
  semis_fab_equipment:"04",
  ai_applications:    "05",
  international:      "06",
};

export default function ThemeSection({ theme, companies }: { theme: SubTheme; companies: CompanyData[] }) {
  return (
    <section style={{ marginBottom: "48px" }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "14px",
        marginBottom: "16px",
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "11px", letterSpacing: "0.2em",
          color: "var(--text-faint)",
        }}>
          {THEME_CODES[theme]}
        </span>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "18px", letterSpacing: "0.12em",
          color: "var(--primary)", textShadow: "var(--glow-sm)",
          margin: 0,
        }}>
          {SUB_THEME_LABELS[theme]}
        </h2>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        <span style={{ fontSize: "10px", color: "var(--text-faint)" }}>
          {companies.length} CO
        </span>
      </div>

      {/* Grid */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1px",
          background: "var(--border)",
        }}
      >
        {companies.map((d) => (
          <div key={d.company.ticker} style={{ background: "var(--bg)" }}>
            <CompanyCard data={d} />
          </div>
        ))}
      </div>
    </section>
  );
}
