import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { EarningsEvent } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "events");

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker param required" }, { status: 400 });
  }

  const tickerDir = path.join(DATA_DIR, ticker);
  try {
    const files = await fs.readdir(tickerDir);
    // Only JSON event files (not transcript.md or summary.json)
    const eventFiles = files
      .filter((f) => f.endsWith(".json") && !f.includes("summary") && !f.includes("transcript"))
      .sort()
      .reverse()
      .slice(0, 4);

    const events: EarningsEvent[] = [];
    for (const file of eventFiles) {
      try {
        const raw = await fs.readFile(path.join(tickerDir, file), "utf-8");
        events.push(JSON.parse(raw));
      } catch {
        // Skip malformed files
      }
    }

    return NextResponse.json(events);
  } catch {
    // Directory doesn't exist yet — return empty
    return NextResponse.json([]);
  }
}
