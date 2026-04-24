import { companies } from "@/lib/companies";
import { promises as fs } from "fs";
import path from "path";
import type { EarningsEvent } from "@/lib/types";
import DataProvider from "@/components/DataProvider";
import DashboardShell, { type CompanyWithEvents } from "@/components/DashboardShell";

// Static rendering is fine — no network calls here
export const dynamic = "force-dynamic";

async function fetchEvents(ticker: string): Promise<EarningsEvent[]> {
  const dir = path.join(process.cwd(), "data", "events", ticker);
  try {
    const files = await fs.readdir(dir);
    const eventFiles = files
      .filter((f) => f.endsWith(".json") && !f.includes("summary") && !f.includes("transcript"))
      .sort()
      .reverse()
      .slice(0, 4);

    const events: EarningsEvent[] = [];
    for (const file of eventFiles) {
      try {
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        const event: EarningsEvent = JSON.parse(raw);
        const takeawaysPath = path.join(dir, file.replace(".json", "-takeaways.md"));
        try {
          event.takeaways_md = await fs.readFile(takeawaysPath, "utf-8");
        } catch {
          event.takeaways_md = null;
        }
        events.push(event);
      } catch {
        // skip malformed
      }
    }
    return events;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const asOf = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // Only disk I/O — no network calls, never times out
  const companiesWithEvents: CompanyWithEvents[] = await Promise.all(
    companies.map(async (company) => ({
      company,
      events: await fetchEvents(company.ticker),
    }))
  );

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            letterSpacing: "0.12em",
            color: "var(--primary)",
            textShadow: "var(--glow)",
            margin: 0,
          }}>
            AI PUBLIC MARKET MONITOR
          </h1>
          <span style={{ fontSize: "10px", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            {companies.length} COMPANIES · 6 THEMES
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            DATA AS OF
          </div>
          <div style={{ fontSize: "12px", color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
            {asOf}
          </div>
        </div>
      </header>

      {/* ── Client shell: ticker tape + cards (fetches /api/market-data) ── */}
      <DataProvider>
        <DashboardShell companiesWithEvents={companiesWithEvents} />
      </DataProvider>
    </div>
  );
}
