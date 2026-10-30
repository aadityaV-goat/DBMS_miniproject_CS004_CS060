// Creates (or resets) the two demo logins with bcrypt-hashed passwords.
//   npm run seed:users
// Passwords are read from .env.local (SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD)
// so they are not written in the source code. Safe to run again: it updates
// the existing rows instead of failing on the UNIQUE username.
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

config({ path: ".env.local", quiet: true });

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

// username, role, employee it belongs to, env var holding its password
const DEMO_USERS = [
  { username: "admin", role: "ADMIN", employeeId: 1, passwordVar: "SEED_ADMIN_PASSWORD" },     // Rohan Das, Manager
  { username: "reception", role: "STAFF", employeeId: 2, passwordVar: "SEED_STAFF_PASSWORD" }, // Kavya Menon, Receptionist
] as const;

// Cost factor 10 = 2^10 hashing rounds: slow enough to resist guessing, fast enough to log in.
const BCRYPT_ROUNDS = 10;

async function main() {
  const conn = await mysql.createConnection({
    host: env("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
  });

  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(env(u.passwordVar), BCRYPT_ROUNDS);
    await conn.execute(
      `INSERT INTO APP_USER (username, password_hash, role, employee_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
                               role = VALUES(role),
                               employee_id = VALUES(employee_id)`,
      [u.username, hash, u.role, u.employeeId],
    );
    console.log(`✔ ${u.username} (${u.role}) linked to employee ${u.employeeId}`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
