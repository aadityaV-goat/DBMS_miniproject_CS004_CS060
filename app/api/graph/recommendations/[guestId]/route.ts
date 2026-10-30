// GET /api/graph/recommendations/:guestId – Neo4j service recommendations for one guest.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { notFound, parseId } from "@/lib/api";
import { NEO4J_PAUSED_HINT } from "@/lib/neo4j";
import { recommendForGuest, similarGuests } from "@/lib/queries/graph";

export async function GET(request: Request, { params }: { params: Promise<{ guestId: string }> }) {
  const auth = await requireRole("ADMIN", "STAFF");
  if (!auth.ok) return auth.response;
  const guestId = parseId((await params).guestId);
  if (!guestId) return notFound("Guest");

  try {
    // ?similar=1 also returns the most similar guests (used on the insights page).
    if (new URL(request.url).searchParams.get("similar")) {
      const [recommendations, similar] = await Promise.all([recommendForGuest(guestId), similarGuests(guestId)]);
      return NextResponse.json({ recommendations, similar });
    }
    return NextResponse.json(await recommendForGuest(guestId));
  } catch (err) {
    console.error("Neo4j query failed:", err);
    return NextResponse.json({ error: NEO4J_PAUSED_HINT }, { status: 503 });
  }
}
