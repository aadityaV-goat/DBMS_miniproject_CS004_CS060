// Input rules shared by API routes (zod). The database checks again with its
// own constraints; these give quicker, clearer messages for obvious mistakes.
import { z } from "zod";

// Phone and email are NOT NULL in 01_schema.sql, so they are required here too.
const phone = z.string().trim().min(1, "is required").max(20);
const email = z.string().trim().max(120).regex(/^\S+@\S+\.\S+$/, "is not a valid email");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use a date like 2026-11-01");
const id = z.coerce.number().int().positive();
const money = z.coerce.number().min(0, "can't be negative").max(99999999);

export const GuestSchema = z.object({
  first_name: z.string().trim().min(1, "is required").max(50),
  last_name: z.string().trim().min(1, "is required").max(50),
  phone,
  email,
});

export const RoomSchema = z.object({
  room_number: z.string().trim().min(1, "is required").max(10),
  floor: z.coerce.number().int().min(0).max(200),
  type_id: id,
});

export const RoomTypeSchema = z.object({
  type_name: z.string().trim().min(1, "is required").max(50),
  base_rate: money,
});

export const ServiceSchema = z.object({
  service_name: z.string().trim().min(1, "is required").max(80),
  price: money,
});

export const EmployeeSchema = z.object({
  first_name: z.string().trim().min(1, "is required").max(50),
  last_name: z.string().trim().min(1, "is required").max(50),
  role: z.string().trim().min(1, "is required").max(40),
  phone,
  email,
});

export const NewBookingSchema = z.object({
  guest_id: id,
  room_id: id,
  check_in: isoDate,
  check_out: isoDate,
  service_ids: z.array(id).default([]),
  payment_amount: money.optional().nullable(),
  payment_date: isoDate.optional().nullable(),
});

export const UpdateBookingSchema = z.object({
  room_id: id,
  check_in: isoDate,
  check_out: isoDate,
});

export const PaymentSchema = z.object({
  booking_id: id,
  amount: money.refine((n) => n > 0, "must be more than 0"),
  payment_date: isoDate,
});

export const NewUserSchema = z.object({
  username: z.string().trim().min(3, "must be at least 3 characters").max(50).regex(/^[a-z0-9._-]+$/i, "letters, numbers, . _ - only"),
  password: z.string().min(8, "must be at least 8 characters").max(72), // bcrypt uses only the first 72 bytes
  role: z.enum(["ADMIN", "STAFF"]),
  employee_id: id,
});

export const UpdateUserSchema = z.object({
  role: z.enum(["ADMIN", "STAFF"]),
  password: z.string().max(72).optional().refine((v) => !v || v.length >= 8, "must be at least 8 characters"),
});
