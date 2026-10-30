// GET /api/rooms/availability?check_in=2026-11-01&check_out=2026-11-03&type_id=
// Free rooms for a date range (NOT EXISTS subquery). Returns the SQL too, for the demo.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { badRequest, dbErrorResponse } from "@/lib/api";
import { availableRooms } from "@/lib/queries/rooms";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const checkIn = sp.get("check_in") ?? "";
  const checkOut = sp.get("check_out") ?? "";
  if (!DATE.test(checkIn) || !DATE.test(checkOut)) return badRequest("Pick a check-in and check-out date.");
  if (checkOut <= checkIn) return badRequest("Check-out date must be after the check-in date.");

  try {
    return NextResponse.json(await availableRooms(checkIn, checkOut, Number(sp.get("type_id")) || null));
  } catch (err) {
    return dbErrorResponse(err);
  }
}
