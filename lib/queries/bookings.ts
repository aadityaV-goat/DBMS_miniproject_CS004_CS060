// All SQL for bookings.
import "server-only";
import { pool, query, execute } from "../db";

export type BookingRow = {
  booking_id: number; guest_id: number; guest_name: string; room_number: string; type_name: string;
  check_in: string; check_out: string; num_nights: number;
  total_amount: number; amount_paid: number; balance_due: number; status: "Upcoming" | "In house" | "Completed";
};

// Status is worked out from today's date with CASE, so it is never out of date.
const statusSql = (t: string) => `
  CASE
    WHEN CURDATE() <  ${t}.check_in  THEN 'Upcoming'
    WHEN CURDATE() <  ${t}.check_out THEN 'In house'
    ELSE 'Completed'
  END`;

export type BookingFilters = { from?: string; to?: string; guest_id?: number; room_id?: number };

export async function listBookings(f: BookingFilters): Promise<BookingRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  // A stay is "in" the date range if it overlaps it at all.
  if (f.from) { where.push("v.check_out > ?"); params.push(f.from); }
  if (f.to) { where.push("v.check_in <= ?"); params.push(f.to); }
  if (f.guest_id) { where.push("v.guest_id = ?"); params.push(f.guest_id); }
  if (f.room_id) { where.push("v.room_id = ?"); params.push(f.room_id); }

  return query<BookingRow>(
    `SELECT v.booking_id, v.guest_id, v.guest_name, v.room_id, v.room_number, v.type_name,
            v.check_in, v.check_out, v.num_nights,
            v.total_amount, v.amount_paid, v.balance_due, ${statusSql("v")} AS status
     FROM v_booking_bill v
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY v.check_in DESC, v.booking_id DESC`,
    params,
  );
}

export async function getBooking(id: number) {
  const [details] = await query<Record<string, unknown>>(
    `SELECT d.*, ${statusSql("d")} AS status
     FROM v_booking_details d WHERE d.booking_id = ?`,
    [id],
  );
  if (!details) return null;

  const [[bill], services, [payment]] = await Promise.all([
    query("SELECT room_cost, services_total, total_amount, amount_paid, balance_due FROM v_booking_bill WHERE booking_id = ?", [id]),
    query<{ service_id: number; service_name: string; price: number }>(
      `SELECT s.service_id, s.service_name, s.price
       FROM BOOKING_SERVICE bs JOIN SERVICE s ON s.service_id = bs.service_id
       WHERE bs.booking_id = ? ORDER BY s.service_name`,
      [id],
    ),
    query("SELECT payment_id, payment_date, amount FROM PAYMENT WHERE booking_id = ?", [id]),
  ]);
  // The stored function should give the same total as the view; the page shows both.
  const [{ fn_total }] = await query<{ fn_total: number }>("SELECT fn_booking_total(?) AS fn_total", [id]);

  return { details, bill, services, payment: payment ?? null, fn_total };
}

export type NewBooking = {
  guest_id: number; room_id: number; employee_id: number; check_in: string; check_out: string;
  service_ids: number[]; payment_amount: number | null; payment_date: string | null;
};

// Rubric: stored procedure + transaction. Everything (booking, services,
// payment) is saved by sp_create_booking in ONE transaction; if any part
// fails, MySQL rolls the whole thing back and we get its error message.
export const CREATE_BOOKING_SQL = "CALL sp_create_booking(?, ?, ?, ?, ?, ?, ?, ?, @new_booking_id)";

export async function createBooking(b: NewBooking): Promise<number> {
  // The OUT parameter lives in a session variable (@new_booking_id), so the
  // CALL and the SELECT that reads it must use the SAME connection.
  const conn = await pool.getConnection();
  try {
    await conn.execute(CREATE_BOOKING_SQL, [
      b.guest_id, b.room_id, b.employee_id, b.check_in, b.check_out,
      [...new Set(b.service_ids)].join(","), // '1,3,7'
      b.payment_amount || null,
      b.payment_date || null,
    ]);
    const [rows] = await conn.query("SELECT @new_booking_id AS id");
    return (rows as { id: number }[])[0].id;
  } finally {
    conn.release();
  }
}

// Change dates or room. The BEFORE UPDATE triggers recompute num_nights and
// reject overlaps, so no extra checks are needed here.
export async function updateBooking(id: number, b: { room_id: number; check_in: string; check_out: string }) {
  return (await execute("UPDATE BOOKING SET room_id = ?, check_in = ?, check_out = ? WHERE booking_id = ?", [b.room_id, b.check_in, b.check_out, id])).affectedRows;
}

// Cancel = delete. ON DELETE CASCADE also removes its BOOKING_SERVICE rows and PAYMENT.
export async function cancelBooking(id: number) {
  return (await execute("DELETE FROM BOOKING WHERE booking_id = ?", [id])).affectedRows;
}

export async function addServiceToBooking(bookingId: number, serviceId: number) {
  await execute("INSERT INTO BOOKING_SERVICE (booking_id, service_id) VALUES (?, ?)", [bookingId, serviceId]);
}

export async function removeServiceFromBooking(bookingId: number, serviceId: number) {
  return (await execute("DELETE FROM BOOKING_SERVICE WHERE booking_id = ? AND service_id = ?", [bookingId, serviceId])).affectedRows;
}
