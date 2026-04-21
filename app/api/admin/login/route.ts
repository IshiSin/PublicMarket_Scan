import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_TOKEN = "admin_session_v1";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const cookieStore = await cookies();
  cookieStore.set("admin_auth", SESSION_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
