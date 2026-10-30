// GET  /api/users – app logins (ADMIN)
// POST /api/users – create a login for an employee; the password is bcrypt-hashed here
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse, parseBody } from "@/lib/api";
import { createUser, listUsers } from "@/lib/queries/employees";
import { NewUserSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listUsers());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, NewUserSchema);
  if (!body.ok) return body.response;
  const { password, ...rest } = body.data;
  try {
    const password_hash = await bcrypt.hash(password, 10); // plain password is never stored
    return NextResponse.json({ user_id: await createUser({ ...rest, password_hash }) }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err); // username taken / employee already has a login
  }
}
