// POST /api/auth/login  { username, password }
// Checks the password against the bcrypt hash in APP_USER and, if it matches,
// sets the signed session cookie.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { findUserByUsername } from "@/lib/queries/users";
import { createSessionToken, cookieOptions, homeFor, SESSION_COOKIE } from "@/lib/session";

const LoginSchema = z.object({
  username: z.string({ error: "Enter your username." }).trim().min(1, "Enter your username."),
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password."),
});

// Compared against when the username does not exist, so a wrong username takes
// as long as a wrong password and attackers cannot tell which usernames exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const user = await findUserByUsername(username);
  const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    // Same message for both cases, on purpose.
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.user_id,
    username: user.username,
    role: user.role,
    employeeId: user.employee_id,
    name: user.name,
  });

  const response = NextResponse.json({ role: user.role, redirectTo: homeFor(user.role) });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return response;
}
