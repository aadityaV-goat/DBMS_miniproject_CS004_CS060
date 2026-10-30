// GET  /api/guests?q=text  – list, or full-text search when q is given
// POST /api/guests         – add a guest
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createGuest, listGuests, searchGuests } from "@/lib/queries/guests";
import { GuestSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const q = new URL(request.url).searchParams.get("q")?.trim();
  try {
    return NextResponse.json(q ? await searchGuests(q) : await listGuests());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, GuestSchema);
  if (!body.ok) return body.response;
  try {
    const guest_id = await createGuest(body.data);
    return NextResponse.json({ guest_id }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err); // e.g. duplicate email → friendly 409
  }
}
