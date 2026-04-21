import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "admin_session_v1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 });

  try {
    const resp = await fetch(
      `${BACKEND}/scrape?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(35000) }
    );
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
