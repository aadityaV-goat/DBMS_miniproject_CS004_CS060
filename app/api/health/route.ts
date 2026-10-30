// GET /api/health – checks that the app can reach both databases.
// Open http://localhost:3000/api/health in the browser to see the result.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { runCypher, NEO4J_PAUSED_HINT } from "@/lib/neo4j";

export const dynamic = "force-dynamic"; // always check live, never cache

async function checkMysql() {
  try {
    const [row] = await query<{ version: string; user: string; guests: number }>(
      "SELECT VERSION() AS version, CURRENT_USER() AS user, (SELECT COUNT(*) FROM GUEST) AS guests",
    );
    return { ok: true, ...row };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function checkNeo4j() {
  try {
    const [row] = await runCypher<{ nodes: number }>("MATCH (n) RETURN count(n) AS nodes");
    return { ok: true, nodes: row.nodes };
  } catch (err) {
    return { ok: false, error: (err as Error).message, hint: NEO4J_PAUSED_HINT };
  }
}

export async function GET() {
  // Run both checks at the same time.
  const [mysql, neo4j] = await Promise.all([checkMysql(), checkNeo4j()]);
  const ok = mysql.ok && neo4j.ok;
  return NextResponse.json({ ok, mysql, neo4j }, { status: ok ? 200 : 503 });
}
