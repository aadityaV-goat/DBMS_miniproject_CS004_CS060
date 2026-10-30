// GET  /api/room-types – list with room counts (anyone logged in)
// POST /api/room-types – add (ADMIN)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createRoomType, listRoomTypes } from "@/lib/queries/rooms";
import { RoomTypeSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listRoomTypes());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, RoomTypeSchema);
  if (!body.ok) return body.response;
  try {
    return NextResponse.json({ type_id: await createRoomType(body.data) }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
