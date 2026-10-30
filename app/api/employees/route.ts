// GET  /api/employees – list (ADMIN)
// POST /api/employees – add (ADMIN)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createEmployee, listEmployees } from "@/lib/queries/employees";
import { EmployeeSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listEmployees());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, EmployeeSchema);
  if (!body.ok) return body.response;
  try {
    return NextResponse.json({ employee_id: await createEmployee(body.data) }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
