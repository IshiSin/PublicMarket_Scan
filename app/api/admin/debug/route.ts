import { NextResponse } from "next/server";

export async function GET() {
  const pw = process.env.ADMIN_PASSWORD;
  return NextResponse.json({
    set: !!pw,
    length: pw?.length ?? 0,
    // Show first/last char to catch quote or whitespace issues
    first: pw?.[0] ?? null,
    last: pw?.[pw.length - 1] ?? null,
  });
}
