// All SQL for employees and their app logins (ADMIN only).
import "server-only";
import { query, execute } from "../db";

// Each employee with how many bookings they handled and their login (if any).
export async function listEmployees() {
  return query(
    `SELECT e.employee_id, e.first_name, e.last_name, e.role, e.phone, e.email,
            COUNT(b.booking_id) AS bookings_handled,
            u.username, u.role AS app_role
     FROM EMPLOYEE e
     LEFT JOIN BOOKING b  ON b.employee_id = e.employee_id
     LEFT JOIN APP_USER u ON u.employee_id = e.employee_id
     GROUP BY e.employee_id, e.first_name, e.last_name, e.role, e.phone, e.email, u.username, u.role
     ORDER BY e.employee_id`,
  );
}

export type EmployeeInput = { first_name: string; last_name: string; role: string; phone: string | null; email: string | null };

export async function createEmployee(e: EmployeeInput) {
  return (await execute("INSERT INTO EMPLOYEE (first_name, last_name, role, phone, email) VALUES (?, ?, ?, ?, ?)", [e.first_name, e.last_name, e.role, e.phone, e.email])).insertId;
}
export async function updateEmployee(id: number, e: EmployeeInput) {
  return (await execute("UPDATE EMPLOYEE SET first_name = ?, last_name = ?, role = ?, phone = ?, email = ? WHERE employee_id = ?", [e.first_name, e.last_name, e.role, e.phone, e.email, id])).affectedRows;
}
// FK RESTRICT if they handled bookings; their APP_USER login is removed by ON DELETE CASCADE.
export async function deleteEmployee(id: number) {
  return (await execute("DELETE FROM EMPLOYEE WHERE employee_id = ?", [id])).affectedRows;
}

// Logins. password_hash is never sent to the browser.
export async function listUsers() {
  return query(
    `SELECT u.user_id, u.username, u.role, u.employee_id, u.created_at,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.role AS job_title
     FROM APP_USER u JOIN EMPLOYEE e ON e.employee_id = u.employee_id
     ORDER BY u.user_id`,
  );
}

export async function createUser(u: { username: string; password_hash: string; role: string; employee_id: number }) {
  return (await execute("INSERT INTO APP_USER (username, password_hash, role, employee_id) VALUES (?, ?, ?, ?)", [u.username, u.password_hash, u.role, u.employee_id])).insertId;
}
export async function updateUserRole(id: number, role: string) {
  return (await execute("UPDATE APP_USER SET role = ? WHERE user_id = ?", [role, id])).affectedRows;
}
export async function updateUserPassword(id: number, passwordHash: string) {
  return (await execute("UPDATE APP_USER SET password_hash = ? WHERE user_id = ?", [passwordHash, id])).affectedRows;
}
export async function deleteUser(id: number) {
  return (await execute("DELETE FROM APP_USER WHERE user_id = ?", [id])).affectedRows;
}
