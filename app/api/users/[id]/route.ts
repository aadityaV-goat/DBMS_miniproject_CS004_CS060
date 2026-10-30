// PUT    /api/users/:id – change role and/or reset password (ADMIN)
// DELETE /api/users/:id – remove a login (ADMIN)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import { badRequest, dbErrorResponse, notFound, parseBody, parseId } from "@/lib/api";
import { deleteUser, updateUserPassword, updateUserRole } from "@/lib/queries/employees";
import { UpdateUserSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("User");

  const body = await parseBody(request, UpdateUserSchema);
  if (!body.ok) return body.response;
  // Stop an admin from locking themselves out.
  if (id === auth.user.userId && body.data.role !== "ADMIN") return badRequest("You can't remove your own admin role.");

  try {
    if (!(await updateUserRole(id, body.data.role))) return notFound("User");
    if (body.data.password) await updateUserPassword(id, await bcrypt.hash(body.data.password, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound("User");
  if (id === auth.user.userId) return badRequest("You can't delete your own login.");

  try {
    if (!(await deleteUser(id))) return notFound("User");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
