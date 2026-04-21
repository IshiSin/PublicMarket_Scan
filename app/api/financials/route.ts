import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { Financials } from "@/lib/types";

const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";
const TTL = 24 * 60 * 60; // 24 hours

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker param required" }, { status: 400 });
  }

  const cacheKey = `financials:${ticker}`;
  const cached = await cacheGet<Financials>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const resp = await fetch(`${BACKEND}/financials?ticker=${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`Backend returned ${resp.status}`);
    const data = await resp.json();
    await cacheSet(cacheKey, data, TTL);
    return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch financials", detail: String(err) },
      { status: 502 }
    );
  }
}
