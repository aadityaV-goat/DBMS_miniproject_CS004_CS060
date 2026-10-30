// Copies MySQL data into Neo4j from the command line:
//   npm run sync:neo4j
// Same code as the admin "Sync now" button (lib/graph/sync.ts). Safe to re-run.
import { config } from "dotenv";
import mysql from "mysql2/promise";
import neo4j from "neo4j-driver";
import { syncMysqlToNeo4j } from "../lib/graph/sync";

config({ path: ".env.local", quiet: true });

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

async function main() {
  const conn = await mysql.createConnection({
    host: env("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    dateStrings: true,
  });
  const driver = neo4j.driver(env("NEO4J_URI"), neo4j.auth.basic(env("NEO4J_USERNAME"), env("NEO4J_PASSWORD")));

  try {
    const sql = async (q: string) => (await conn.query(q))[0] as Record<string, unknown>[];
    const result = await syncMysqlToNeo4j(sql, driver, process.env.NEO4J_DATABASE || undefined);
    console.log("✔ Synced MySQL → Neo4j", result);
  } finally {
    await conn.end();
    await driver.close();
  }
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  console.error("If Neo4j can't be reached, the Aura instance may be paused: resume it at console.neo4j.io.");
  process.exit(1);
});
