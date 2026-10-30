// GET /api/auth/me – who is logged in (any role).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole();
  if (!auth.ok) return auth.response;
  return NextResponse.json(auth.user);
}
