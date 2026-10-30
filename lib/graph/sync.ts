// Copies the current MySQL data into Neo4j. Used by both the admin "Sync"
// button (POST /api/graph/sync) and the command line (npm run sync:neo4j),
// so it takes its database connections as arguments.
//
// Graph model:
//   (:Guest)-[:STAYED_IN {booking_id, check_in, check_out, nights}]->(:Room)-[:OF_TYPE]->(:RoomType)
//   (:Guest)-[:USED {times}]->(:Service)
//
// MySQL stays the source of truth; Neo4j is a read-only copy shaped for
// relationship questions ("guests like you also enjoyed…").
import neo4j, { type Driver } from "neo4j-driver";

type SqlRunner = (sql: string) => Promise<Record<string, unknown>[]>;

// Unique constraints double as indexes, so MERGE on these ids is fast and
// can never create duplicate nodes.
const CONSTRAINTS = [
  "CREATE CONSTRAINT guest_id IF NOT EXISTS FOR (g:Guest) REQUIRE g.guest_id IS UNIQUE",
  "CREATE CONSTRAINT room_id IF NOT EXISTS FOR (r:Room) REQUIRE r.room_id IS UNIQUE",
  "CREATE CONSTRAINT room_type_id IF NOT EXISTS FOR (t:RoomType) REQUIRE t.type_id IS UNIQUE",
  "CREATE CONSTRAINT service_id IF NOT EXISTS FOR (s:Service) REQUIRE s.service_id IS UNIQUE",
];

export type SyncResult = { guests: number; rooms: number; roomTypes: number; services: number; stays: number; serviceUses: number; ms: number };

export async function syncMysqlToNeo4j(sql: SqlRunner, driver: Driver, database?: string): Promise<SyncResult> {
  const started = Date.now();

  // 1. Read everything we need from MySQL.
  const [guests, roomTypes, rooms, services, stays, uses] = await Promise.all([
    sql("SELECT guest_id, CONCAT(first_name, ' ', last_name) AS name, email FROM GUEST"),
    sql("SELECT type_id, type_name AS name, base_rate FROM ROOM_TYPE"),
    sql("SELECT room_id, room_number AS number, floor, type_id FROM ROOM"),
    sql("SELECT service_id, service_name AS name, price FROM SERVICE"),
    sql("SELECT booking_id, guest_id, room_id, check_in, check_out, num_nights AS nights FROM BOOKING"),
    // A guest may use a service on several stays; store it once with a count.
    sql(`SELECT b.guest_id, bs.service_id, COUNT(*) AS times
         FROM BOOKING b JOIN BOOKING_SERVICE bs ON bs.booking_id = b.booking_id
         GROUP BY b.guest_id, bs.service_id`),
  ]);

  // DATE columns may arrive as Date objects or strings depending on the
  // connection settings; store plain 'YYYY-MM-DD' strings either way.
  const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  // JS numbers would be stored as floats (1.0); ids and counts should be integers.
  const int = (v: unknown) => neo4j.int(Number(v));
  const num = (v: unknown) => Number(v);

  const session = driver.session({ database });
  try {
    for (const c of CONSTRAINTS) await session.run(c); // schema changes can't share a write transaction

    // 2. Write everything in ONE transaction: the graph is never half-synced.
    await session.executeWrite(async (tx) => {
      // MERGE = "find it, or create it". Running the sync twice gives the same graph.
      await tx.run(
        `UNWIND $rows AS row
         MERGE (t:RoomType {type_id: row.type_id})
         SET t.name = row.name, t.base_rate = row.base_rate`,
        { rows: roomTypes.map((r) => ({ type_id: int(r.type_id), name: r.name, base_rate: num(r.base_rate) })) },
      );
      await tx.run(
        `UNWIND $rows AS row
         MERGE (r:Room {room_id: row.room_id})
         SET r.number = row.number, r.floor = row.floor
         WITH r, row
         MATCH (t:RoomType {type_id: row.type_id})
         OPTIONAL MATCH (r)-[old:OF_TYPE]->(:RoomType)
         DELETE old
         MERGE (r)-[:OF_TYPE]->(t)`,
        { rows: rooms.map((r) => ({ room_id: int(r.room_id), number: r.number, floor: int(r.floor), type_id: int(r.type_id) })) },
      );
      await tx.run(
        `UNWIND $rows AS row
         MERGE (s:Service {service_id: row.service_id})
         SET s.name = row.name, s.price = row.price`,
        { rows: services.map((s) => ({ service_id: int(s.service_id), name: s.name, price: num(s.price) })) },
      );
      await tx.run(
        `UNWIND $rows AS row
         MERGE (g:Guest {guest_id: row.guest_id})
         SET g.name = row.name, g.email = row.email`,
        { rows: guests.map((g) => ({ guest_id: int(g.guest_id), name: g.name, email: g.email ?? null })) },
      );

      // Stays and service use change all the time (bookings get cancelled or
      // edited), so rebuild these relationships from scratch.
      await tx.run("MATCH ()-[r:STAYED_IN|USED]->() DELETE r");
      await tx.run(
        `UNWIND $rows AS row
         MATCH (g:Guest {guest_id: row.guest_id}), (r:Room {room_id: row.room_id})
         MERGE (g)-[s:STAYED_IN {booking_id: row.booking_id}]->(r)
         SET s.check_in = row.check_in, s.check_out = row.check_out, s.nights = row.nights`,
        {
          rows: stays.map((b) => ({
            booking_id: int(b.booking_id), guest_id: int(b.guest_id), room_id: int(b.room_id),
            check_in: day(b.check_in), check_out: day(b.check_out), nights: int(b.nights),
          })),
        },
      );
      await tx.run(
        `UNWIND $rows AS row
         MATCH (g:Guest {guest_id: row.guest_id}), (s:Service {service_id: row.service_id})
         MERGE (g)-[u:USED]->(s)
         SET u.times = row.times`,
        { rows: uses.map((u) => ({ guest_id: int(u.guest_id), service_id: int(u.service_id), times: int(u.times) })) },
      );

      // Remove nodes for rows that were deleted in MySQL.
      await tx.run("MATCH (g:Guest) WHERE NOT g.guest_id IN $ids DETACH DELETE g", { ids: guests.map((g) => int(g.guest_id)) });
      await tx.run("MATCH (r:Room) WHERE NOT r.room_id IN $ids DETACH DELETE r", { ids: rooms.map((r) => int(r.room_id)) });
      await tx.run("MATCH (t:RoomType) WHERE NOT t.type_id IN $ids DETACH DELETE t", { ids: roomTypes.map((t) => int(t.type_id)) });
      await tx.run("MATCH (s:Service) WHERE NOT s.service_id IN $ids DETACH DELETE s", { ids: services.map((s) => int(s.service_id)) });

      // Remember when we last synced (shown on the insights page).
      await tx.run("MERGE (m:SyncInfo {id: 1}) SET m.synced_at = datetime()");
    });
  } finally {
    await session.close();
  }

  return {
    guests: guests.length, rooms: rooms.length, roomTypes: roomTypes.length, services: services.length,
    stays: stays.length, serviceUses: uses.length, ms: Date.now() - started,
  };
}
