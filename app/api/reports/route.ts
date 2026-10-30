// GET /api/reports – list of available reports with their SQL (ADMIN)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { reportCatalog } from "@/lib/queries/reports";

export async function GET() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  return NextResponse.json(reportCatalog());
}
