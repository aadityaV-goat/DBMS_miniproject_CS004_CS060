// GET    /api/guests/:id – guest + bookings with bills + services used
// PUT    /api/guests/:id – edit
// DELETE /api/guests/:id – blocked by the database if the guest has bookings
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, isRowInUse, notFound, parseBody, parseId } from "@/lib/api";
import { deleteGuest, getGuest, getGuestBookings, getGuestServices, updateGuest } from "@/lib/queries/guests";
import { GuestSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Guest");

  try {
    const guest = await getGuest(id);
    if (!guest) return notFound("Guest");
    const [bookings, services] = await Promise.all([getGuestBookings(id), getGuestServices(id)]);
    return NextResponse.json({ guest, bookings, services });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Guest");

  const body = await parseBody(request, GuestSchema);
  if (!body.ok) return body.response;
  try {
    if (!(await updateGuest(id, body.data))) return notFound("Guest");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Guest");

  try {
    if (!(await deleteGuest(id))) return notFound("Guest");
    return NextResponse.json({ ok: true });
  } catch (err) {
    // FK RESTRICT from BOOKING → GUEST: say it in the receptionist's words.
    if (isRowInUse(err)) {
      return NextResponse.json(
        { error: "This guest has bookings, so they can't be deleted. Cancel their bookings first." },
        { status: 409 },
      );
    }
    return dbErrorResponse(err);
  }
}
