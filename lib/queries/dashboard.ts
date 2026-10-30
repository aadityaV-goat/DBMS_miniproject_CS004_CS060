// All SQL for the dashboard. Each query is exported so it can be shown in the viva.
import "server-only";
import { query } from "../db";

// KPI cards: four scalar subqueries in one SELECT.
export const KPI_SQL = `
  SELECT
    (SELECT COUNT(*) FROM GUEST) AS total_guests,
    (SELECT COUNT(*) FROM ROOM)  AS total_rooms,
    (SELECT COUNT(DISTINCT room_id) FROM BOOKING
       WHERE CURDATE() >= check_in AND CURDATE() < check_out)                 AS rooms_occupied_today,
    (SELECT COUNT(*) FROM BOOKING
       WHERE check_in BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY)      AS upcoming_checkins,
    (SELECT COALESCE(SUM(amount), 0) FROM PAYMENT
       WHERE payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         AND payment_date <  DATE_FORMAT(CURDATE(), '%Y-%m-01') + INTERVAL 1 MONTH) AS revenue_this_month,
    (SELECT COALESCE(SUM(balance_due), 0) FROM v_booking_bill WHERE balance_due > 0) AS outstanding`;

// Payments received per calendar month (GROUP BY + aggregate + ORDER BY).
export const REVENUE_BY_MONTH_SQL = `
  SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month,
         SUM(amount)                         AS revenue,
         COUNT(*)                            AS payments
  FROM PAYMENT
  GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
  ORDER BY month`;

// Billed revenue per room type (JOIN through the view + GROUP BY).
export const REVENUE_BY_ROOM_TYPE_SQL = `
  SELECT type_name,
         COUNT(*)          AS bookings,
         SUM(num_nights)   AS nights,
         SUM(total_amount) AS revenue
  FROM v_booking_bill
  GROUP BY type_name
  ORDER BY revenue DESC`;

// Services booked more than once (HAVING filters groups, WHERE can't).
export const POPULAR_SERVICES_SQL = `
  SELECT s.service_name,
         COUNT(*)            AS times_used,
         COUNT(*) * s.price  AS revenue
  FROM BOOKING_SERVICE bs
  JOIN SERVICE s ON s.service_id = bs.service_id
  GROUP BY s.service_id, s.service_name, s.price
  HAVING COUNT(*) > 1
  ORDER BY times_used DESC, revenue DESC`;

// Next arrivals.
export const UPCOMING_SQL = `
  SELECT booking_id, guest_id, guest_name, room_number, check_in, num_nights
  FROM v_booking_details
  WHERE check_in BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY
  ORDER BY check_in, booking_id`;

export async function getDashboard() {
  const [[kpis], revenueByMonth, revenueByRoomType, popularServices, upcoming] = await Promise.all([
    query(KPI_SQL),
    query(REVENUE_BY_MONTH_SQL),
    query(REVENUE_BY_ROOM_TYPE_SQL),
    query(POPULAR_SERVICES_SQL),
    query(UPCOMING_SQL),
  ]);
  return {
    kpis,
    revenueByMonth,
    revenueByRoomType,
    popularServices,
    upcoming,
    sql: {
      kpis: KPI_SQL,
      revenueByMonth: REVENUE_BY_MONTH_SQL,
      revenueByRoomType: REVENUE_BY_ROOM_TYPE_SQL,
      popularServices: POPULAR_SERVICES_SQL,
    },
  };
}
