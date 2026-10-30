// PUT    /api/payments/:id – change amount/date (trigger re-checks the limit)
// DELETE /api/payments/:id – remove a payment entered by mistake
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, notFound, parseBody, parseId } from "@/lib/api";
import { deletePayment, updatePayment } from "@/lib/queries/payments";
import { PaymentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Payment");

  const body = await parseBody(request, PaymentSchema.omit({ booking_id: true }));
  if (!body.ok) return body.response;
  try {
    if (!(await updatePayment(id, body.data))) return notFound("Payment");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Payment");

  try {
    if (!(await deletePayment(id))) return notFound("Payment");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
