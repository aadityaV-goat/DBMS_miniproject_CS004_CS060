// POST /api/graph/sync – copy MySQL into Neo4j (ADMIN only; also enforced in middleware).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { driver, NEO4J_PAUSED_HINT } from "@/lib/neo4j";
import { syncMysqlToNeo4j } from "@/lib/graph/sync";

export async function POST() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const result = await syncMysqlToNeo4j((sql) => query(sql), driver, process.env.NEO4J_DATABASE || undefined);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Neo4j sync failed:", err);
    return NextResponse.json({ error: `${NEO4J_PAUSED_HINT} (${(err as Error).message})` }, { status: 503 });
  }
}
