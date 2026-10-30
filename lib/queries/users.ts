// All SQL for login accounts (APP_USER).
import "server-only";
import { query } from "../db";
import type { Role } from "../session";

export type UserWithHash = {
  user_id: number;
  username: string;
  password_hash: string;
  role: Role;
  employee_id: number;
  name: string;
};

// JOIN with EMPLOYEE so the session can show the person's real name.
export async function findUserByUsername(username: string): Promise<UserWithHash | null> {
  const rows = await query<UserWithHash>(
    `SELECT u.user_id, u.username, u.password_hash, u.role, u.employee_id,
            CONCAT(e.first_name, ' ', e.last_name) AS name
     FROM APP_USER u
     JOIN EMPLOYEE e ON e.employee_id = u.employee_id
     WHERE u.username = ?`,
    [username],
  );
  return rows[0] ?? null;
}
