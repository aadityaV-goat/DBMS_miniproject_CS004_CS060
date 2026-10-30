// GET  /api/bookings?from=&to=&guest_id=&room_id=  – list with filters
// POST /api/bookings                               – new booking via sp_create_booking
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { badRequest, dbErrorResponse, parseBody } from "@/lib/api";
import { createBooking, listBookings } from "@/lib/queries/bookings";
import { NewBookingSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(sp.get(k) ?? "") ? sp.get(k)! : undefined);
  try {
    return NextResponse.json(
      await listBookings({
        from: date("from"),
        to: date("to"),
        guest_id: Number(sp.get("guest_id")) || undefined,
        room_id: Number(sp.get("room_id")) || undefined,
      }),
    );
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, NewBookingSchema);
  if (!body.ok) return body.response;
  if (body.data.check_out <= body.data.check_in) return badRequest("Check-out date must be after the check-in date.");

  try {
    const booking_id = await createBooking({
      ...body.data,
      employee_id: auth.user.employeeId, // the logged-in employee "handles" the booking
      payment_amount: body.data.payment_amount ?? null,
      payment_date: body.data.payment_date ?? null,
    });
    return NextResponse.json({ booking_id }, { status: 201 });
  } catch (err) {
    // e.g. "Room is not available for the selected dates." from the procedure,
    // or "Payment of … is more than the booking total" from the trigger.
    return dbErrorResponse(err);
  }
}
