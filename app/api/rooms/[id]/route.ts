// PUT    /api/rooms/:id – edit (ADMIN)
// DELETE /api/rooms/:id – delete (ADMIN); blocked by FK RESTRICT if the room has bookings
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, isRowInUse, notFound, parseBody, parseId } from "@/lib/api";
import { deleteRoom, updateRoom } from "@/lib/queries/rooms";
import { RoomSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Room");

  const body = await parseBody(request, RoomSchema);
  if (!body.ok) return body.response;
  try {
    if (!(await updateRoom(id, body.data))) return notFound("Room");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Room");

  try {
    if (!(await deleteRoom(id))) return notFound("Room");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isRowInUse(err)) {
      return NextResponse.json({ error: "This room has bookings, so it can't be deleted." }, { status: 409 });
    }
    return dbErrorResponse(err);
  }
}
