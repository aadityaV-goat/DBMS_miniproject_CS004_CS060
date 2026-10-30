// PUT    /api/room-types/:id – edit (ADMIN)
// DELETE /api/room-types/:id – delete (ADMIN); blocked by FK RESTRICT if rooms use it
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, isRowInUse, notFound, parseBody, parseId } from "@/lib/api";
import { deleteRoomType, updateRoomType } from "@/lib/queries/rooms";
import { RoomTypeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Room type");

  const body = await parseBody(request, RoomTypeSchema);
  if (!body.ok) return body.response;
  try {
    if (!(await updateRoomType(id, body.data))) return notFound("Room type");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Room type");

  try {
    if (!(await deleteRoomType(id))) return notFound("Room type");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isRowInUse(err)) {
      return NextResponse.json({ error: "Some rooms still use this room type, so it can't be deleted." }, { status: 409 });
    }
    return dbErrorResponse(err);
  }
}
