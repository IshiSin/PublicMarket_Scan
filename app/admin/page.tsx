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
      if (res.ok) {
        onLogin();
      } else {
        setError("Invalid password");
      }
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

function IngestForm({ event, onDone }: { event: EarningsEvent; onDone: () => void }) {
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
    <div className="border border-neutral-800 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-white">{event.ticker}</span>
          <span className="text-xs text-neutral-500 ml-2">{event.fiscal_quarter}</span>
          <span className="text-xs text-neutral-600 ml-2">
            {new Date(event.report_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <button
          onClick={() => submit("unavailable")}
          disabled={loading}
          className="text-xs text-neutral-600 hover:text-neutral-400 underline"
        >
          Mark unavailable
        </button>
      </div>

      {/* URL fetch */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="url"
          value={scrapeUrl}
          onChange={(e) => setScrapeUrl(e.target.value)}
          placeholder="Paste URL to auto-fetch transcript (investing.com, fool.com, etc.)"
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
        />
        <button
          onClick={fetchFromUrl}
          disabled={scraping || !scrapeUrl.trim()}
          className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-4 py-2 rounded whitespace-nowrap disabled:opacity-50"
        >
          {scraping ? "Fetching…" : "Fetch"}
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Transcript text will appear here after fetching, or paste manually…"
        rows={10}
        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-neutral-600 resize-y"
      />

      <input
        type="url"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="Source URL (auto-filled after fetch, or enter manually)"
        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={() => submit("ingest")}
        disabled={loading || !text.trim()}
        className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save transcript + extract AI summary"}
      </button>
    </div>
  );
}

// ── Admin Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [events, setEvents] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadPendingEvents() {
    setLoading(true);
    try {
      // Load companies list via API route and fetch events per ticker
      const companiesRes = await fetch("/api/companies").catch(() => null);
      if (!companiesRes) return;

      const companies = await companiesRes.json().catch(() => []);
      const allEvents: EarningsEvent[] = [];

      await Promise.all(
        companies.map(async (c: { ticker: string }) => {
          try {
            const res = await fetch(`/api/events?ticker=${c.ticker}`);
            if (res.ok) {
              const evs: EarningsEvent[] = await res.json();
              allEvents.push(...evs.filter((e) => e.transcript_status === "pending"));
            }
          } catch {}
        })
      );

      allEvents.sort(
        (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
      );
      setEvents(allEvents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadPendingEvents();
  }, [authed]);

  if (!authed) {
    return <LoginForm onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h1 className="text-sm font-bold text-white">Transcript Ingestion</h1>
        <a href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Dashboard
        </a>
      </div>

      {loading && <p className="text-xs text-neutral-500">Loading pending events…</p>}

      {!loading && events.length === 0 && (
        <p className="text-xs text-neutral-600">No pending transcripts.</p>
      )}

      {events.map((ev) => (
        <IngestForm
          key={`${ev.ticker}-${ev.fiscal_quarter}`}
          event={ev}
          onDone={() => {
            setEvents((prev) =>
              prev.filter(
                (e) => !(e.ticker === ev.ticker && e.fiscal_quarter === ev.fiscal_quarter)
              )
            );
          }}
        />
      ))}
    </div>
  );
}
