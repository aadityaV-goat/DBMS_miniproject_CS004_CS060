// Small helpers shared by all API routes.
import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

// Turns a MySQL error into a message a receptionist can understand.
// The database is the real validator (CHECK, UNIQUE, FK, triggers); this just
// translates its answer instead of letting the page crash.
export function dbErrorResponse(err: unknown) {
  const e = err as { errno?: number; sqlMessage?: string; message?: string };
  const raw = e.sqlMessage ?? e.message ?? "Unknown database error";

  switch (e.errno) {
    case 1644: // SIGNAL SQLSTATE '45000' from our triggers / procedure: already human-readable
      return NextResponse.json({ error: raw }, { status: 409 });

    case 1062: { // UNIQUE / PRIMARY KEY violation
      const key = raw.match(/for key '([^']+)'/)?.[1] ?? "";
      return NextResponse.json({ error: duplicateMessage(key) }, { status: 409 });
    }

    case 1451: // FK RESTRICT: row is still referenced by a child row
    case 1217:
      return NextResponse.json(
        { error: "This record is still in use (for example by a booking), so it can't be deleted." },
        { status: 409 },
      );

    case 1452: // FK: the parent row doesn't exist
    case 1216:
      return NextResponse.json({ error: "One of the selected items no longer exists. Refresh and try again." }, { status: 400 });

    case 3819: { // CHECK constraint failed
      const name = raw.match(/Check constraint '([^']+)'/)?.[1] ?? "";
      return NextResponse.json({ error: CHECK_MESSAGES[name] ?? `Value not allowed (${name}).` }, { status: 400 });
    }

    case 1048: // NOT NULL
      return NextResponse.json({ error: `A required field is missing: ${raw}` }, { status: 400 });

    case 1406: // VARCHAR too long
      return NextResponse.json({ error: "One of the values is too long." }, { status: 400 });

    default:
      console.error("Unexpected DB error:", err);
      return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

function duplicateMessage(key: string) {
  if (key.endsWith("email")) return "That email address is already used by someone else.";
  if (key.endsWith("room_number")) return "A room with that number already exists.";
  if (key.endsWith("username")) return "That username is taken.";
  if (key.endsWith("employee_id") && key.startsWith("app_user")) return "That employee already has a login.";
  if (key.endsWith("booking_id") && key.startsWith("payment")) return "This booking already has a payment. Edit that payment instead.";
  if (key.endsWith("PRIMARY") && key.startsWith("booking_service")) return "That service is already on this booking.";
  return "That record already exists.";
}

// Names come from the CHECK constraints in 01_schema.sql / 02 / 03.
const CHECK_MESSAGES: Record<string, string> = {
  chk_booking_dates: "Check-out date must be after the check-in date.",
  booking_chk_1: "Number of nights must be at least 1.",
  room_type_chk_1: "Base rate can't be negative.",
  service_chk_1: "Price can't be negative.",
  payment_chk_1: "Payment amount can't be negative.",
  chk_username_length: "Username must be at least 3 characters.",
};

// Validates a JSON body with a zod schema.
//   const body = await parseBody(request, Schema);
//   if (!body.ok) return body.response;
export async function parseBody<T extends z.ZodType>(request: Request, schema: T) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".");
    return {
      ok: false as const,
      response: NextResponse.json({ error: field ? `${field}: ${issue.message}` : issue.message }, { status: 400 }),
    };
  }
  return { ok: true as const, data: parsed.data as z.infer<T> };
}

// Route params like /api/guests/[id] arrive as strings.
export function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// True when a DELETE was blocked by ON DELETE RESTRICT. MySQL reports 1451 or,
// when it hides the child table's details, 1217 – treat both the same.
export function isRowInUse(err: unknown) {
  const errno = (err as { errno?: number }).errno;
  return errno === 1451 || errno === 1217;
}

export const notFound = (what: string) => NextResponse.json({ error: `${what} not found.` }, { status: 404 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
