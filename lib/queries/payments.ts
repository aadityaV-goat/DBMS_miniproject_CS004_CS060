// All SQL for payments.
import "server-only";
import { query, execute } from "../db";

export async function listPayments() {
  return query(
    `SELECT p.payment_id, p.payment_date, p.amount, p.booking_id,
            CONCAT(g.first_name, ' ', g.last_name) AS guest_name, r.room_number
     FROM PAYMENT p
     JOIN BOOKING b ON b.booking_id = p.booking_id
     JOIN GUEST g   ON g.guest_id   = b.guest_id
     JOIN ROOM r    ON r.room_id    = b.room_id
     ORDER BY p.payment_date DESC, p.payment_id DESC`,
  );
}

// Bookings that still owe money, biggest first (from the v_booking_bill view).
export async function listOutstanding() {
  return query(
    `SELECT booking_id, guest_id, guest_name, room_number, check_in, check_out,
            total_amount, amount_paid, balance_due
     FROM v_booking_bill
     WHERE balance_due > 0
     ORDER BY balance_due DESC`,
  );
}

export type PaymentInput = { booking_id: number; amount: number; payment_date: string };

// UNIQUE(booking_id) allows one payment per booking; trg_payment_limit_bi
// rejects amounts larger than the bill.
export async function createPayment(p: PaymentInput) {
  return (await execute("INSERT INTO PAYMENT (payment_date, amount, booking_id) VALUES (?, ?, ?)", [p.payment_date, p.amount, p.booking_id])).insertId;
}

export async function updatePayment(id: number, p: { amount: number; payment_date: string }) {
  return (await execute("UPDATE PAYMENT SET amount = ?, payment_date = ? WHERE payment_id = ?", [p.amount, p.payment_date, id])).affectedRows;
}

export async function deletePayment(id: number) {
  return (await execute("DELETE FROM PAYMENT WHERE payment_id = ?", [id])).affectedRows;
}
