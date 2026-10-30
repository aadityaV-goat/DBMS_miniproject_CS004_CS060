// Runs before EVERY request (pages and API). It is the first gate:
//   1. not logged in          → pages redirect to /login, APIs get 401
//   2. STAFF on admin-only    → pages redirect home,      APIs get 403
// Each API route checks the role again with requireRole() (defence in depth).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken, homeFor } from "./lib/session";

// Reachable without logging in.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

// Whole sections only an ADMIN may open.
const ADMIN_ONLY_PREFIXES = ["/employees", "/reports", "/api/employees", "/api/users", "/api/reports", "/api/graph/sync"];

// STAFF may look at rooms and services (GET) but not add, change or delete them.
const ADMIN_WRITE_PREFIXES = ["/api/rooms", "/api/room-types", "/api/services"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.includes(pathname)) {
    // Already logged in? Skip the login form.
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL(homeFor(session.role), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const adminOnly =
    startsWithAny(pathname, ADMIN_ONLY_PREFIXES) ||
    (request.method !== "GET" && startsWithAny(pathname, ADMIN_WRITE_PREFIXES));

  if (adminOnly && session.role !== "ADMIN") {
    if (isApi) return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
    return NextResponse.redirect(new URL(homeFor(session.role) + "?denied=1", request.url));
  }

  return NextResponse.next();
}

// Skip Next.js internals and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
