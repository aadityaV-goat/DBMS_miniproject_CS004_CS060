// GET /api/graph/insights – graph size, popular service pairs, room type → services.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { NEO4J_PAUSED_HINT } from "@/lib/neo4j";
import { graphInsights } from "@/lib/queries/graph";

export async function GET() {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await graphInsights());
  } catch (err) {
    console.error("Neo4j query failed:", err);
    return NextResponse.json({ error: NEO4J_PAUSED_HINT }, { status: 503 });
  }
}
