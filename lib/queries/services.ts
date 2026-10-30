// All SQL for add-on services.
import "server-only";
import { query, execute } from "../db";

// Each service with how often it was booked and the revenue it brought in.
export async function listServices() {
  return query<{ service_id: number; service_name: string; price: number; times_used: number; revenue: number }>(
    `SELECT s.service_id, s.service_name, s.price,
            COUNT(bs.booking_id)      AS times_used,
            COUNT(bs.booking_id) * s.price AS revenue
     FROM SERVICE s
     LEFT JOIN BOOKING_SERVICE bs ON bs.service_id = s.service_id
     GROUP BY s.service_id, s.service_name, s.price
     ORDER BY s.service_name`,
  );
}

export type ServiceInput = { service_name: string; price: number };

export async function createService(s: ServiceInput) {
  return (await execute("INSERT INTO SERVICE (service_name, price) VALUES (?, ?)", [s.service_name, s.price])).insertId;
}
export async function updateService(id: number, s: ServiceInput) {
  return (await execute("UPDATE SERVICE SET service_name = ?, price = ? WHERE service_id = ?", [s.service_name, s.price, id])).affectedRows;
}
// FK RESTRICT (BOOKING_SERVICE → SERVICE) blocks this if any booking used the service.
export async function deleteService(id: number) {
  return (await execute("DELETE FROM SERVICE WHERE service_id = ?", [id])).affectedRows;
}
