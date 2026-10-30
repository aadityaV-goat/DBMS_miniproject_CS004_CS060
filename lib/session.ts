// Login sessions as a signed JWT stored in an httpOnly cookie.
// This file uses only `jose`, so it can run both in API routes and in
// middleware.ts (which runs in a lighter "edge" runtime without MySQL).
import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "STAFF";

export type Session = {
  userId: number;
  username: string;
  role: Role;
  employeeId: number;
  name: string; // employee's full name, shown in the sidebar
};

export const SESSION_COOKIE = "resort_session";
export const SESSION_HOURS = 8; // one work shift

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET in .env.local");
  return new TextEncoder().encode(secret);
}

// The token is signed (HS256) with AUTH_SECRET: anyone can read it, but nobody
// can change the role inside it without the signature check failing.
export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

// Returns the session, or null if the token is missing, tampered with or expired.
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      role: payload.role as Role,
      employeeId: payload.employeeId as number,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,                                   // JavaScript in the browser cannot read it
  secure: process.env.NODE_ENV === "production",    // HTTPS-only once deployed
  sameSite: "lax" as const,                         // not sent on cross-site form posts (CSRF protection)
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60,
};

// Where each role lands after logging in.
export function homeFor(role: Role) {
  return role === "ADMIN" ? "/dashboard" : "/bookings";
}
