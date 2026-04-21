import { NextResponse } from "next/server";
import { companies } from "@/lib/companies";

export async function GET() {
  return NextResponse.json(companies);
}
