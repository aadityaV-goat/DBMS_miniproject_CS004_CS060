// GET  /api/rooms?type_id=&floor=  – list (anyone logged in)
// POST /api/rooms                  – add (ADMIN)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createRoom, listFloors, listRooms } from "@/lib/queries/rooms";
import { RoomSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const type_id = Number(sp.get("type_id")) || undefined;
  const floor = sp.get("floor") ? Number(sp.get("floor")) : undefined;
  try {
    const [rooms, floors] = await Promise.all([listRooms({ type_id, floor }), listFloors()]);
    return NextResponse.json({ rooms, floors });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, RoomSchema);
  if (!body.ok) return body.response;
  try {
    return NextResponse.json({ room_id: await createRoom(body.data) }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err); // duplicate room_number → 409
  }
}
