// GET    /api/bookings/:id – details + bill (v_booking_bill) + services + payment
// PUT    /api/bookings/:id – change room/dates (triggers re-check overlap & nights)
// DELETE /api/bookings/:id – cancel (CASCADE removes its services and payment)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { badRequest, dbErrorResponse, notFound, parseBody, parseId } from "@/lib/api";
import { cancelBooking, getBooking, updateBooking } from "@/lib/queries/bookings";
import { UpdateBookingSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Booking");

  try {
    const booking = await getBooking(id);
    return booking ? NextResponse.json(booking) : notFound("Booking");
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Booking");

  const body = await parseBody(request, UpdateBookingSchema);
  if (!body.ok) return body.response;
  if (body.data.check_out <= body.data.check_in) return badRequest("Check-out date must be after the check-in date.");
  try {
    if (!(await updateBooking(id, body.data))) return notFound("Booking");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err); // overlap → trigger message
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Booking");

  try {
    if (!(await cancelBooking(id))) return notFound("Booking");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
