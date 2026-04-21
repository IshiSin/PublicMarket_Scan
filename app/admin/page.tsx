"use client";

import { useState, useEffect } from "react";
import type { EarningsEvent } from "@/lib/types";

// ── Auth ──────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) onLogin();
      else setError("Invalid password");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form onSubmit={submit} className="space-y-4 w-64">
        <h1 className="text-sm font-bold text-white">Admin Login</h1>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-sm py-2 rounded disabled:opacity-50"
        >
          {loading ? "…" : "Login"}
        </button>
      </form>
    </div>
  );
}

// ── Ingest Form ───────────────────────────────────────────────────────────────

function IngestForm({
  event,
  onDone,
}: {
  event: EarningsEvent;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");

  async function fetchFromUrl() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/scrape?url=${encodeURIComponent(scrapeUrl)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setText(data.text);
      setSourceUrl(scrapeUrl);
    } catch (e) {
      setError(`Fetch failed: ${String(e)}`);
    } finally {
      setScraping(false);
    }
  }

  async function submit(action: "ingest" | "unavailable") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: event.ticker,
          fiscal_quarter: event.fiscal_quarter,
          transcript_text: action === "ingest" ? text : undefined,
          transcript_source_url: sourceUrl || undefined,
          action: action === "unavailable" ? "mark_unavailable" : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Unknown error");
      }
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* URL fetch */}
      <div className="flex gap-2">
        <input
          type="url"
          value={scrapeUrl}
          onChange={(e) => setScrapeUrl(e.target.value)}
          placeholder="Paste URL to auto-fetch (investing.com, fool.com, etc.)"
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
        />
        <button
          onClick={fetchFromUrl}
          disabled={scraping || !scrapeUrl.trim()}
          className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-4 py-2 rounded whitespace-nowrap disabled:opacity-50"
        >
          {scraping ? "Fetching…" : "Fetch from URL"}
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Transcript text appears here after fetching — or paste manually"
        rows={12}
        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-neutral-600 resize-y"
      />

      <input
        type="url"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="Source URL (auto-filled after fetch, or paste manually)"
        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => submit("ingest")}
          disabled={loading || !text.trim()}
          className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save + extract AI summary"}
        </button>
        <button
          onClick={() => submit("unavailable")}
          disabled={loading}
          className="text-xs text-neutral-600 hover:text-neutral-400 underline"
        >
          Mark unavailable
        </button>
      </div>
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [allEvents, setAllEvents] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Selection state
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");

  async function loadAllEvents() {
    setLoading(true);
    try {
      const companiesRes = await fetch("/api/companies").catch(() => null);
      if (!companiesRes) return;
      const companies = await companiesRes.json().catch(() => []);
      const events: EarningsEvent[] = [];

      await Promise.all(
        companies.map(async (c: { ticker: string }) => {
          try {
            const res = await fetch(`/api/events?ticker=${c.ticker}`);
            if (res.ok) {
              const evs: EarningsEvent[] = await res.json();
              // Show pending + published (so you can see what's done)
              events.push(...evs);
            }
          } catch {}
        })
      );

      events.sort(
        (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
      );
      setAllEvents(events);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadAllEvents();
  }, [authed]);

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />;

  // Unique tickers that have pending events
  const pendingEvents = allEvents.filter((e) => e.transcript_status === "pending");
  const tickers = [...new Set(pendingEvents.map((e) => e.ticker))].sort();

  // Quarters for selected ticker
  const quartersForTicker = pendingEvents
    .filter((e) => e.ticker === selectedTicker)
    .map((e) => e.fiscal_quarter)
    .sort()
    .reverse();

  // The active event
  const activeEvent = allEvents.find(
    (e) => e.ticker === selectedTicker && e.fiscal_quarter === selectedQuarter
  );

  function handleTickerChange(ticker: string) {
    setSelectedTicker(ticker);
    // Auto-select most recent quarter for this ticker
    const quarters = pendingEvents
      .filter((e) => e.ticker === ticker)
      .map((e) => e.fiscal_quarter)
      .sort()
      .reverse();
    setSelectedQuarter(quarters[0] ?? "");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-sm font-bold text-white">Transcript Ingestion</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {pendingEvents.length} pending · {allEvents.filter((e) => e.transcript_status === "published").length} published
          </p>
        </div>
        <a href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Dashboard
        </a>
      </div>

      {loading && <p className="text-xs text-neutral-500">Loading events…</p>}

      {!loading && pendingEvents.length === 0 && (
        <p className="text-xs text-neutral-600">No pending transcripts.</p>
      )}

      {!loading && pendingEvents.length > 0 && (
        <>
          {/* ── Selectors ── */}
          <div className="flex gap-3">
            {/* Ticker picker */}
            <div className="flex-1">
              <label className="text-xs text-neutral-500 block mb-1">Company</label>
              <select
                value={selectedTicker}
                onChange={(e) => handleTickerChange(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
              >
                <option value="">— select company —</option>
                {tickers.map((t) => {
                  const count = pendingEvents.filter((e) => e.ticker === t).length;
                  return (
                    <option key={t} value={t}>
                      {t} ({count} pending)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quarter picker */}
            <div className="flex-1">
              <label className="text-xs text-neutral-500 block mb-1">Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                disabled={!selectedTicker}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 disabled:opacity-40"
              >
                <option value="">— select quarter —</option>
                {quartersForTicker.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Active event summary ── */}
          {activeEvent && (
            <div className="border border-neutral-800 rounded p-3 text-xs text-neutral-400 flex gap-6">
              <span>
                <span className="text-neutral-600">Report date</span>{" "}
                {new Date(activeEvent.report_date).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
              <span>
                <span className="text-neutral-600">EPS actual</span>{" "}
                {activeEvent.eps_actual ?? "—"}
              </span>
              <span>
                <span className="text-neutral-600">EPS est</span>{" "}
                {activeEvent.eps_estimate ?? "—"}
              </span>
              <span>
                <span className="text-neutral-600">Status</span>{" "}
                <span className={
                  activeEvent.transcript_status === "published" ? "text-emerald-400" :
                  activeEvent.transcript_status === "pending"   ? "text-yellow-400" :
                  "text-neutral-500"
                }>
                  {activeEvent.transcript_status}
                </span>
              </span>
            </div>
          )}

          {/* ── Ingest form ── */}
          {activeEvent && activeEvent.transcript_status === "pending" && (
            <IngestForm
              key={`${activeEvent.ticker}-${activeEvent.fiscal_quarter}`}
              event={activeEvent}
              onDone={() => {
                loadAllEvents(); // refresh list after save
                setSelectedQuarter("");
              }}
            />
          )}

          {activeEvent && activeEvent.transcript_status === "published" && (
            <div className="space-y-3">
              <div className="border border-emerald-900 rounded p-3 text-xs text-emerald-400 flex items-center justify-between">
                <span>
                  Published
                  {activeEvent.transcript_source_url && (
                    <a
                      href={activeEvent.transcript_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 underline text-emerald-300"
                    >
                      View source →
                    </a>
                  )}
                </span>
                <span className="text-neutral-500">Re-ingest below to update</span>
              </div>
              <IngestForm
                key={`${activeEvent.ticker}-${activeEvent.fiscal_quarter}-edit`}
                event={activeEvent}
                onDone={loadAllEvents}
              />
            </div>
          )}

          {!activeEvent && selectedTicker && selectedQuarter && (
            <p className="text-xs text-neutral-600">No event found for {selectedTicker} {selectedQuarter}.</p>
          )}

          {!selectedTicker && (
            <p className="text-xs text-neutral-600">Select a company and quarter above to begin.</p>
          )}
        </>
      )}
    </div>
  );
}
