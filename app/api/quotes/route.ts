import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { Quote } from "@/lib/types";

const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";
const TTL = 60; // 60 seconds

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get("tickers");
  if (!tickers) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickerList = tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const cacheKey = `quotes:${tickerList.sort().join(",")}`;

  // Try cache first
  const cached = await cacheGet<Record<string, Quote>>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const resp = await fetch(`${BACKEND}/quotes?tickers=${encodeURIComponent(tickerList.join(","))}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) {
      throw new Error(`Backend returned ${resp.status}`);
    }
    const data = await resp.json();
    await cacheSet(cacheKey, data, TTL);
    return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch quotes", detail: String(err) },
      { status: 502 }
    );
  }
}
