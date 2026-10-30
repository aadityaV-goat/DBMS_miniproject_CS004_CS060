// MySQL connection pool, shared by every API route.
// This file runs only on the server; the browser never sees it or the credentials.
import "server-only";
import mysql from "mysql2/promise";
import { requireEnv } from "./env";

// A pool keeps a few connections open and reuses them, instead of opening a
// new connection for every request.
function createPool() {
  return mysql.createPool({
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    connectionLimit: 10,
    dateStrings: true,      // return DATE columns as '2026-11-01', not JS Date objects (avoids timezone shifts)
    decimalNumbers: true,   // return DECIMAL columns as numbers, not strings
  });
}

// In development Next.js reloads modules on every edit. Keeping the pool on
// globalThis stops it from opening a new pool (and new connections) each time.
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };
export const pool = globalForDb.mysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = pool;

// Values go in `params` and are matched to the ? placeholders by MySQL itself
// (a prepared statement), so user input can never change the SQL: no SQL injection.
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params as never[]);
  return rows as T[];
}

// For INSERT / UPDATE / DELETE: returns insertId and affectedRows.
export async function execute(sql: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params as never[]);
  return result as mysql.ResultSetHeader;
}
