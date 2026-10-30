// Server-side auth helpers used inside API routes and server pages.
import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, type Role, type Session } from "./session";

// Reads and verifies the session cookie of the current request.
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

type AuthResult = { ok: true; user: Session } | { ok: false; response: NextResponse };

// Every API route starts with this. middleware.ts already blocks most bad
// requests, but checking again here means a route stays safe even if the
// middleware rules are changed later ("defence in depth").
//
//   const auth = await requireRole("ADMIN");
//   if (!auth.ok) return auth.response;
export async function requireRole(...allowed: Role[]): Promise<AuthResult> {
  const user = await getSession();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  }
  if (allowed.length > 0 && !allowed.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Only an admin can do this." }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
