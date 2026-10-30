// GET  /api/payments – all payments + bookings with a balance due
// POST /api/payments – record a payment for a booking
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createPayment, listOutstanding, listPayments } from "@/lib/queries/payments";
import { PaymentSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  try {
    const [payments, outstanding] = await Promise.all([listPayments(), listOutstanding()]);
    return NextResponse.json({ payments, outstanding });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, PaymentSchema);
  if (!body.ok) return body.response;
  try {
    return NextResponse.json({ payment_id: await createPayment(body.data) }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err); // second payment → UNIQUE; too much → trigger
  }
}
