// PUT    /api/employees/:id – edit (ADMIN)
// DELETE /api/employees/:id – delete (ADMIN); blocked if they handled bookings
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { badRequest, dbErrorResponse, isRowInUse, notFound, parseBody, parseId } from "@/lib/api";
import { deleteEmployee, updateEmployee } from "@/lib/queries/employees";
import { EmployeeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Employee");

  const body = await parseBody(request, EmployeeSchema);
  if (!body.ok) return body.response;
  try {
    if (!(await updateEmployee(id, body.data))) return notFound("Employee");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("Employee");
  if (id === auth.user.employeeId) return badRequest("You can't delete your own employee record.");

  try {
    if (!(await deleteEmployee(id))) return notFound("Employee");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isRowInUse(err)) {
      return NextResponse.json({ error: "This employee has handled bookings, so they can't be deleted." }, { status: 409 });
    }
    return dbErrorResponse(err);
  }
}
