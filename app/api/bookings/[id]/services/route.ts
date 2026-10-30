// POST   /api/bookings/:id/services  { service_id }  – add a service to a booking
// DELETE /api/bookings/:id/services?service_id=      – remove it
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, notFound, parseBody, parseId } from "@/lib/api";
import { addServiceToBooking, removeServiceFromBooking } from "@/lib/queries/bookings";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Booking");

  const body = await parseBody(request, z.object({ service_id: z.coerce.number().int().positive() }));
  if (!body.ok) return body.response;
  try {
    await addServiceToBooking(id, body.data.service_id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err); // duplicate → "already on this booking"
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  const serviceId = parseId(new URL(request.url).searchParams.get("service_id") ?? "");
  if (!id || !serviceId) return notFound("Service on booking");

  try {
    if (!(await removeServiceFromBooking(id, serviceId))) return notFound("Service on booking");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
