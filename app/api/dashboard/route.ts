// GET /api/dashboard – KPI cards, charts and lists for the dashboard page.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api";
import { getDashboard } from "@/lib/queries/dashboard";

export async function GET() {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await getDashboard());
  } catch (err) {
    return dbErrorResponse(err);
  }
}
