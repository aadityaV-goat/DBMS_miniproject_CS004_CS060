// All SQL for rooms and room types.
import "server-only";
import { query, execute } from "../db";

export type Room = {
  room_id: number; room_number: string; floor: number; type_id: number; type_name: string; base_rate: number;
  occupied_today: 0 | 1;
};

// Filters are optional; we add "AND ..." only for the ones given, but the
// values still go through ? placeholders.
export async function listRooms(filters: { type_id?: number; floor?: number }): Promise<Room[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.type_id) { where.push("r.type_id = ?"); params.push(filters.type_id); }
  if (filters.floor !== undefined) { where.push("r.floor = ?"); params.push(filters.floor); }

  return query<Room>(
    `SELECT r.room_id, r.room_number, r.floor, r.type_id, rt.type_name, rt.base_rate,
            EXISTS (SELECT 1 FROM BOOKING b
                    WHERE b.room_id = r.room_id
                      AND CURDATE() >= b.check_in AND CURDATE() < b.check_out) AS occupied_today
     FROM ROOM r
     JOIN ROOM_TYPE rt ON rt.type_id = r.type_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY r.floor, r.room_number`,
    params,
  );
}

export async function listFloors(): Promise<number[]> {
  const rows = await query<{ floor: number }>("SELECT DISTINCT floor FROM ROOM ORDER BY floor");
  return rows.map((r) => r.floor);
}

// Rubric: subquery (NOT EXISTS). A room is free if NO booking for it overlaps
// the requested stay. Two stays overlap when each starts before the other ends.
export const AVAILABLE_ROOMS_SQL = `
  SELECT r.room_id, r.room_number, r.floor, rt.type_name, rt.base_rate,
         DATEDIFF(?, ?) * rt.base_rate AS stay_cost
  FROM ROOM r
  JOIN ROOM_TYPE rt ON rt.type_id = r.type_id
  WHERE NOT EXISTS (
          SELECT 1 FROM BOOKING b
          WHERE b.room_id   = r.room_id
            AND b.check_in  < ?      -- existing stay starts before the new one ends
            AND b.check_out > ?      -- and ends after the new one starts
        )
    AND (? IS NULL OR r.type_id = ?)
  ORDER BY rt.base_rate, r.room_number`;

export async function availableRooms(checkIn: string, checkOut: string, typeId: number | null) {
  const params = [checkOut, checkIn, checkOut, checkIn, typeId, typeId];
  return { sql: AVAILABLE_ROOMS_SQL, params, rows: await query(AVAILABLE_ROOMS_SQL, params) };
}

export type RoomInput = { room_number: string; floor: number; type_id: number };

export async function createRoom(r: RoomInput) {
  return (await execute("INSERT INTO ROOM (room_number, floor, type_id) VALUES (?, ?, ?)", [r.room_number, r.floor, r.type_id])).insertId;
}
export async function updateRoom(id: number, r: RoomInput) {
  return (await execute("UPDATE ROOM SET room_number = ?, floor = ?, type_id = ? WHERE room_id = ?", [r.room_number, r.floor, r.type_id, id])).affectedRows;
}
export async function deleteRoom(id: number) {
  return (await execute("DELETE FROM ROOM WHERE room_id = ?", [id])).affectedRows; // FK RESTRICT if booked
}

// Room types with how many rooms use each (LEFT JOIN + GROUP BY).
export async function listRoomTypes() {
  return query<{ type_id: number; type_name: string; base_rate: number; room_count: number }>(
    `SELECT rt.type_id, rt.type_name, rt.base_rate, COUNT(r.room_id) AS room_count
     FROM ROOM_TYPE rt
     LEFT JOIN ROOM r ON r.type_id = rt.type_id
     GROUP BY rt.type_id, rt.type_name, rt.base_rate
     ORDER BY rt.base_rate`,
  );
}

export type RoomTypeInput = { type_name: string; base_rate: number };

export async function createRoomType(t: RoomTypeInput) {
  return (await execute("INSERT INTO ROOM_TYPE (type_name, base_rate) VALUES (?, ?)", [t.type_name, t.base_rate])).insertId;
}
export async function updateRoomType(id: number, t: RoomTypeInput) {
  return (await execute("UPDATE ROOM_TYPE SET type_name = ?, base_rate = ? WHERE type_id = ?", [t.type_name, t.base_rate, id])).affectedRows;
}
export async function deleteRoomType(id: number) {
  return (await execute("DELETE FROM ROOM_TYPE WHERE type_id = ?", [id])).affectedRows; // FK RESTRICT if rooms use it
}
