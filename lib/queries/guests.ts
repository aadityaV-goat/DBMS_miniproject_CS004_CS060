// All SQL for guests.
import "server-only";
import { query, execute } from "../db";

export type Guest = {
  guest_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  booking_count: number;
  total_spent: number;
  score?: number;
};

// List with booking count and amount paid per guest.
// LEFT JOIN keeps guests with no bookings; GROUP BY rolls bookings up per guest.
const LIST_SQL = `
  SELECT g.guest_id, g.first_name, g.last_name, g.phone, g.email,
         COUNT(b.booking_id)           AS booking_count,
         COALESCE(SUM(b.amount_paid),0) AS total_spent
  FROM GUEST g
  LEFT JOIN v_booking_bill b ON b.guest_id = g.guest_id`;

export async function listGuests(): Promise<Guest[]> {
  return query<Guest>(`${LIST_SQL} GROUP BY g.guest_id ORDER BY g.first_name, g.last_name`);
}

// Turns "pri rao" into "+pri* +rao*" for MATCH ... AGAINST in BOOLEAN MODE:
// every word must match (+), and may be the start of a longer word (*).
// Characters with special meaning in boolean mode are stripped out.
function toBooleanQuery(text: string) {
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3) // InnoDB ignores words shorter than innodb_ft_min_token_size (3)
    .map((w) => `+${w}*`)
    .join(" ");
}

// Rubric: Full-text search. Uses the FULLTEXT index ft_guest_search from 04.
export const SEARCH_SQL = `
  ${LIST_SQL}
  WHERE MATCH(g.first_name, g.last_name, g.email) AGAINST (? IN BOOLEAN MODE)
  GROUP BY g.guest_id
  ORDER BY MATCH(g.first_name, g.last_name, g.email) AGAINST (? IN BOOLEAN MODE) DESC, g.first_name`;

export async function searchGuests(text: string): Promise<Guest[]> {
  const q = text.trim();
  if (/^[\d+\s-]+$/.test(q)) {
    // Phone numbers aren't in the full-text index, so use a prefix LIKE for digits.
    return query<Guest>(`${LIST_SQL} WHERE g.phone LIKE ? GROUP BY g.guest_id ORDER BY g.first_name`, [`%${q.replace(/\s/g, "")}%`]);
  }
  const boolean = toBooleanQuery(q);
  if (!boolean) {
    // 1–2 letters: too short for the full-text index, fall back to LIKE on names.
    return query<Guest>(
      `${LIST_SQL} WHERE g.first_name LIKE ? OR g.last_name LIKE ? GROUP BY g.guest_id ORDER BY g.first_name`,
      [`${q}%`, `${q}%`],
    );
  }
  return query<Guest>(SEARCH_SQL, [boolean, boolean]);
}

export async function getGuest(id: number) {
  const rows = await query<Omit<Guest, "booking_count" | "total_spent">>(
    "SELECT guest_id, first_name, last_name, phone, email FROM GUEST WHERE guest_id = ?",
    [id],
  );
  return rows[0] ?? null;
}

// Every booking of one guest with its bill (from the v_booking_bill view).
export async function getGuestBookings(id: number) {
  return query(
    `SELECT booking_id, room_number, type_name, check_in, check_out, num_nights,
            room_cost, services_total, total_amount, amount_paid, balance_due
     FROM v_booking_bill
     WHERE guest_id = ?
     ORDER BY check_in DESC`,
    [id],
  );
}

// Services this guest has used across all stays (also what Neo4j stores as :USED).
export async function getGuestServices(id: number) {
  return query<{ service_id: number; service_name: string; times: number }>(
    `SELECT s.service_id, s.service_name, COUNT(*) AS times
     FROM BOOKING b
     JOIN BOOKING_SERVICE bs ON bs.booking_id = b.booking_id
     JOIN SERVICE s          ON s.service_id  = bs.service_id
     WHERE b.guest_id = ?
     GROUP BY s.service_id, s.service_name
     ORDER BY times DESC, s.service_name`,
    [id],
  );
}

export type GuestInput = { first_name: string; last_name: string; phone: string | null; email: string | null };

export async function createGuest(g: GuestInput) {
  const r = await execute("INSERT INTO GUEST (first_name, last_name, phone, email) VALUES (?, ?, ?, ?)", [
    g.first_name, g.last_name, g.phone, g.email,
  ]);
  return r.insertId;
}

export async function updateGuest(id: number, g: GuestInput) {
  const r = await execute("UPDATE GUEST SET first_name = ?, last_name = ?, phone = ?, email = ? WHERE guest_id = ?", [
    g.first_name, g.last_name, g.phone, g.email, id,
  ]);
  return r.affectedRows;
}

// Fails with FK error 1451 if the guest has bookings (ON DELETE RESTRICT).
export async function deleteGuest(id: number) {
  const r = await execute("DELETE FROM GUEST WHERE guest_id = ?", [id]);
  return r.affectedRows;
}
