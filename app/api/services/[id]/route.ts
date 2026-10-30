// PUT    /api/services/:id – edit (ADMIN)
// DELETE /api/services/:id – delete (ADMIN); blocked if any booking used it
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, isRowInUse, notFound, parseBody, parseId } from "@/lib/api";
import { deleteService, updateService } from "@/lib/queries/services";
import { ServiceSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Service");

  const body = await parseBody(request, ServiceSchema);
  if (!body.ok) return body.response;
  try {
    if (!(await updateService(id, body.data))) return notFound("Service");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Service");

  try {
    if (!(await deleteService(id))) return notFound("Service");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isRowInUse(err)) {
      return NextResponse.json({ error: "This service is on existing bookings, so it can't be deleted." }, { status: 409 });
    }
    return dbErrorResponse(err);
  }
}
