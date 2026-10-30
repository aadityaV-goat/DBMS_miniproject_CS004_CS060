// GET /api/reports/:key?param=value – run one report (ADMIN). Returns the SQL,
// the bound parameter values and the result rows.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { badRequest, dbErrorResponse, notFound } from "@/lib/api";
import { ReportInputError, runReport } from "@/lib/queries/reports";

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { key } = await params;
  const input = Object.fromEntries(new URL(request.url).searchParams);
  try {
    const result = await runReport(key, input);
    return result ? NextResponse.json(result) : notFound("Report");
  } catch (err) {
    if (err instanceof ReportInputError) return badRequest(err.message);
    return dbErrorResponse(err);
  }
}
