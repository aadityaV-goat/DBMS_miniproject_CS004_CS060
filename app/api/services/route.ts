// GET  /api/services – list with usage (anyone logged in)
// POST /api/services – add (ADMIN)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createService, listServices } from "@/lib/queries/services";
import { ServiceSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listServices());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, ServiceSchema);
  if (!body.ok) return body.response;
  try {
    return NextResponse.json({ service_id: await createService(body.data) }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
