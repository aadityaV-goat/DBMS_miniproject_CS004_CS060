// All Cypher (Neo4j) queries. Rubric: NoSQL aggregation.
// Each is exported so the Guest insights page can show it.
import "server-only";
import neo4j from "neo4j-driver";
import { runCypher } from "../neo4j";

// (1) "Guests who used the services you used also used…"
// Walk Guest → Service ← other Guests → their other Services, then count.
// In SQL this needs BOOKING_SERVICE joined to itself several times; in a graph
// it is one path pattern.
export const RECOMMEND_CYPHER = `
MATCH (me:Guest {guest_id: $guestId})-[:USED]->(shared:Service)<-[:USED]-(other:Guest)
WHERE other <> me
WITH me, other, count(DISTINCT shared) AS overlap      // how similar each guest is to me
MATCH (other)-[:USED]->(rec:Service)
WHERE NOT (me)-[:USED]->(rec)                          // only things I haven't tried
RETURN rec.name                AS service,
       rec.price               AS price,
       count(DISTINCT other)   AS similarGuests,
       sum(overlap)            AS score                // more-similar guests count more
ORDER BY score DESC, similarGuests DESC, service
LIMIT 5`;

export async function recommendForGuest(guestId: number) {
  return runCypher(RECOMMEND_CYPHER, { guestId: neo4j.int(guestId) });
}

// (2) Most popular service combinations: pairs of services used by the same guest.
export const COMBOS_CYPHER = `
MATCH (a:Service)<-[:USED]-(g:Guest)-[:USED]->(b:Service)
WHERE a.service_id < b.service_id                      // count each pair once
RETURN a.name AS first, b.name AS second, count(DISTINCT g) AS guests
ORDER BY guests DESC, first, second
LIMIT 8`;

// (3) What guests of each room type go on to use (path across 4 node types).
export const ROOM_TYPE_SERVICES_CYPHER = `
MATCH (t:RoomType)<-[:OF_TYPE]-(:Room)<-[:STAYED_IN]-(g:Guest)-[:USED]->(s:Service)
WITH t, s, count(DISTINCT g) AS guests
ORDER BY guests DESC, s.name
WITH t, collect({service: s.name, guests: guests})[0..3] AS top
RETURN t.name AS roomType, top
ORDER BY roomType`;

// (4) Guests most similar to one guest (by number of shared services).
export const SIMILAR_GUESTS_CYPHER = `
MATCH (me:Guest {guest_id: $guestId})-[:USED]->(s:Service)<-[:USED]-(other:Guest)
WHERE other <> me
RETURN other.guest_id AS guestId, other.name AS name,
       count(DISTINCT s) AS sharedServices, collect(DISTINCT s.name) AS services
ORDER BY sharedServices DESC, name
LIMIT 5`;

export const OVERVIEW_CYPHER = `
CALL () { MATCH (n) WHERE NOT n:SyncInfo RETURN labels(n)[0] AS kind, count(*) AS n
          UNION ALL
          MATCH ()-[r]->() RETURN type(r) AS kind, count(*) AS n }
RETURN kind, n ORDER BY kind`;

export async function similarGuests(guestId: number) {
  return runCypher(SIMILAR_GUESTS_CYPHER, { guestId: neo4j.int(guestId) });
}

export async function graphInsights() {
  const [overview, combos, roomTypeServices, sync] = await Promise.all([
    runCypher<{ kind: string; n: number }>(OVERVIEW_CYPHER),
    runCypher(COMBOS_CYPHER),
    runCypher(ROOM_TYPE_SERVICES_CYPHER),
    runCypher<{ syncedAt: string | null }>("OPTIONAL MATCH (m:SyncInfo {id: 1}) RETURN toString(m.synced_at) AS syncedAt"),
  ]);
  return {
    overview,
    combos,
    roomTypeServices,
    syncedAt: sync[0]?.syncedAt ?? null,
    cypher: { combos: COMBOS_CYPHER, roomTypeServices: ROOM_TYPE_SERVICES_CYPHER, recommend: RECOMMEND_CYPHER, similar: SIMILAR_GUESTS_CYPHER },
  };
}
