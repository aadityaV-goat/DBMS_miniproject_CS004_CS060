// The "important queries" from the problem statement in DBMS_Project.pdf,
// plus a few that show HAVING, subqueries and the stored function.
// Each report keeps its exact SQL so the Reports page can display it.
import "server-only";
import { query } from "../db";
import { AVAILABLE_ROOMS_SQL } from "./rooms";

export type ParamDef = { name: string; label: string; type: "date" | "guest" | "number"; default?: string };

type Report = {
  title: string;
  description: string;
  concepts: string[];
  params: ParamDef[];
  sql: string;
  // Turns the form values into the values for the ? placeholders, in order.
  bind: (p: Record<string, string>) => unknown[];
};

export const REPORTS: Record<string, Report> = {
  availability: {
    title: "1. Rooms available for specific dates",
    description: "Rooms with no booking that overlaps the requested stay.",
    concepts: ["NOT EXISTS subquery", "JOIN"],
    params: [
      { name: "check_in", label: "Check-in", type: "date", default: "2026-11-01" },
      { name: "check_out", label: "Check-out", type: "date", default: "2026-11-04" },
    ],
    sql: AVAILABLE_ROOMS_SQL,
    bind: (p) => [p.check_out, p.check_in, p.check_out, p.check_in, null, null],
  },

  guestBookings: {
    title: "2. Bookings made by a particular guest",
    description: "Every stay of one guest with room, type and the employee who handled it.",
    concepts: ["4-table JOIN", "ORDER BY"],
    params: [{ name: "guest_id", label: "Guest", type: "guest", default: "2" }],
    sql: `
SELECT b.booking_id, b.check_in, b.check_out, b.num_nights,
       r.room_number, rt.type_name,
       CONCAT(e.first_name, ' ', e.last_name) AS handled_by
FROM BOOKING b
JOIN ROOM r       ON r.room_id     = b.room_id
JOIN ROOM_TYPE rt ON rt.type_id    = r.type_id
JOIN EMPLOYEE e   ON e.employee_id = b.employee_id
WHERE b.guest_id = ?
ORDER BY b.check_in`,
    bind: (p) => [p.guest_id],
  },

  guestDue: {
    title: "3. How much a guest must pay, including services",
    description: "Per booking: room cost + services (via the stored function), minus what was paid.",
    concepts: ["Stored function fn_booking_total", "LEFT JOIN", "Aggregate in subquery"],
    params: [{ name: "guest_id", label: "Guest", type: "guest", default: "2" }],
    sql: `
SELECT b.booking_id,
       b.num_nights * rt.base_rate                           AS room_cost,
       (SELECT COALESCE(SUM(s.price), 0)
          FROM BOOKING_SERVICE bs JOIN SERVICE s ON s.service_id = bs.service_id
         WHERE bs.booking_id = b.booking_id)                 AS services_cost,
       fn_booking_total(b.booking_id)                        AS total,
       COALESCE(p.amount, 0)                                 AS paid,
       fn_booking_total(b.booking_id) - COALESCE(p.amount, 0) AS due
FROM BOOKING b
JOIN ROOM r       ON r.room_id  = b.room_id
JOIN ROOM_TYPE rt ON rt.type_id = r.type_id
LEFT JOIN PAYMENT p ON p.booking_id = b.booking_id
WHERE b.guest_id = ?
ORDER BY b.check_in`,
    bind: (p) => [p.guest_id],
  },

  occupancy: {
    title: "4. How many rooms are occupied on a date",
    description: "Occupied rooms, total rooms and the occupancy percentage for one night.",
    concepts: ["COUNT(DISTINCT)", "Scalar subquery", "ROUND"],
    params: [{ name: "date", label: "Date", type: "date", default: "2026-11-02" }],
    sql: `
SELECT ?                                         AS on_date,
       COUNT(DISTINCT b.room_id)                 AS rooms_occupied,
       (SELECT COUNT(*) FROM ROOM)               AS total_rooms,
       ROUND(100 * COUNT(DISTINCT b.room_id)
                 / (SELECT COUNT(*) FROM ROOM), 1) AS occupancy_pct
FROM BOOKING b
WHERE ? >= b.check_in AND ? < b.check_out`,
    bind: (p) => [p.date, p.date, p.date],
  },

  revenue: {
    title: "5. Revenue generated during a period",
    description: "Payments received between two dates, split by room type, with a grand total row.",
    concepts: ["GROUP BY … WITH ROLLUP", "SUM / COUNT / AVG", "BETWEEN"],
    params: [
      { name: "from", label: "From", type: "date", default: "2026-08-01" },
      { name: "to", label: "To", type: "date", default: "2026-10-31" },
    ],
    sql: `
SELECT COALESCE(rt.type_name, 'ALL ROOM TYPES') AS room_type,
       COUNT(*)                                 AS payments,
       SUM(p.amount)                            AS revenue,
       ROUND(AVG(p.amount), 2)                  AS avg_payment
FROM PAYMENT p
JOIN BOOKING b    ON b.booking_id = p.booking_id
JOIN ROOM r       ON r.room_id    = b.room_id
JOIN ROOM_TYPE rt ON rt.type_id   = r.type_id
WHERE p.payment_date BETWEEN ? AND ?
GROUP BY rt.type_name WITH ROLLUP`,
    bind: (p) => [p.from, p.to],
  },

  topGuests: {
    title: "6. Guests who spent more than the average guest",
    description: "Total paid per guest, keeping only guests above the overall average.",
    concepts: ["HAVING with a subquery", "Derived table", "GROUP BY"],
    params: [],
    sql: `
SELECT g.guest_id,
       CONCAT(g.first_name, ' ', g.last_name) AS guest,
       COUNT(DISTINCT b.booking_id)           AS bookings,
       SUM(p.amount)                          AS total_paid
FROM GUEST g
JOIN BOOKING b ON b.guest_id   = g.guest_id
JOIN PAYMENT p ON p.booking_id = b.booking_id
GROUP BY g.guest_id, g.first_name, g.last_name
HAVING SUM(p.amount) > (
    SELECT AVG(per_guest.total)
    FROM (SELECT b2.guest_id, SUM(p2.amount) AS total
          FROM BOOKING b2 JOIN PAYMENT p2 ON p2.booking_id = b2.booking_id
          GROUP BY b2.guest_id) AS per_guest
)
ORDER BY total_paid DESC`,
    bind: () => [],
  },

  staffWorkload: {
    title: "7. Bookings handled per employee",
    description: "How many bookings and nights each employee has handled, busiest first.",
    concepts: ["LEFT JOIN", "GROUP BY", "ORDER BY aggregate"],
    params: [],
    sql: `
SELECT CONCAT(e.first_name, ' ', e.last_name) AS employee,
       e.role,
       COUNT(b.booking_id)                    AS bookings,
       COALESCE(SUM(b.num_nights), 0)         AS nights
FROM EMPLOYEE e
LEFT JOIN BOOKING b ON b.employee_id = e.employee_id
GROUP BY e.employee_id, e.first_name, e.last_name, e.role
ORDER BY bookings DESC, employee`,
    bind: () => [],
  },
};

// Validates the inputs for a report, then runs it.
export async function runReport(key: string, input: Record<string, string>) {
  const report = REPORTS[key];
  if (!report) return null;

  for (const p of report.params) {
    const v = input[p.name] ?? "";
    if (p.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ReportInputError(`${p.label}: pick a date.`);
    if (p.type !== "date" && !/^\d+$/.test(v)) throw new ReportInputError(`${p.label}: choose a value.`);
  }

  const params = report.bind(input);
  const rows = await query(report.sql, params);
  return { sql: report.sql, params, rows };
}

export class ReportInputError extends Error {}

// What the page needs to draw the report cards (no functions).
export function reportCatalog() {
  return Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title, description: r.description, concepts: r.concepts, params: r.params, sql: r.sql }));
}
