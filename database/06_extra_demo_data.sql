-- Resort Management System – extra demo data
-- Run AFTER 01–04:   mysql -u root -p < database/06_extra_demo_data.sql
--
-- Why: in 02_seed_data.sql every guest has one booking and every service is
-- used exactly once. That makes the "services used more than once" (HAVING)
-- query, the revenue-by-month chart and the Neo4j "guests like you also
-- enjoyed" recommendations come out empty. This file adds:
--   * more add-on services on the existing 10 bookings
--   * 9 past stays (Aug–Oct 2026) with payments
--   * 3 stays around 30 Oct 2026 (occupied rooms, partial/no payment)
--
-- Every insert goes through the triggers in 04 (num_nights is computed,
-- overlaps and over-payments are rejected), so this data is also a test.
--
-- Re-runnable: bookings 11–22 are deleted first (ON DELETE CASCADE removes
-- their services and payments). WARNING: that also deletes any booking the
-- web app created with those ids. Run 01–04 again first for a clean slate.

USE resort_entries;

DELETE FROM BOOKING WHERE booking_id BETWEEN 11 AND 22;

-- More services on the original bookings. ON DUPLICATE KEY makes a second run a no-op.
INSERT INTO BOOKING_SERVICE (booking_id, service_id) VALUES
(1,3),(1,7),
(2,1),(2,8),
(3,1),(3,7),
(4,1),(4,8),(4,10),
(5,4),(5,9),(5,7),
(6,1),(6,8),
(7,2),(7,10),
(8,1),(8,3),
(9,7),(9,4),
(10,1),(10,10),(10,2)
ON DUPLICATE KEY UPDATE service_id = service_id;

-- num_nights is omitted on purpose: trg_booking_set_nights_bi fills it in.
INSERT INTO BOOKING (booking_id, check_in, check_out, guest_id, room_id, employee_id) VALUES
-- past stays
(11,'2026-08-05','2026-08-08', 1, 6, 2),
(12,'2026-08-12','2026-08-14', 4, 3, 4),
(13,'2026-08-20','2026-08-25', 5,10, 2),
(14,'2026-09-03','2026-09-05', 2, 7,10),
(15,'2026-09-10','2026-09-13', 6, 9, 2),
(16,'2026-09-18','2026-09-20', 8, 2, 4),
(17,'2026-10-02','2026-10-04', 3, 8,10),
(18,'2026-10-10','2026-10-14', 9, 5, 2),
(19,'2026-10-15','2026-10-17',10, 1, 4),
-- in-house around 30 Oct 2026
(20,'2026-10-28','2026-10-31', 7, 4, 2),
(21,'2026-10-29','2026-11-01', 2, 9,10),
(22,'2026-10-30','2026-11-02', 4, 8, 4);

INSERT INTO BOOKING_SERVICE (booking_id, service_id) VALUES
(11,1),(11,7),
(12,1),(12,8),
(13,4),(13,9),(13,10),
(14,8),(14,5),
(15,1),(15,7),(15,10),
(16,1),(16,8),
(17,2),(17,3),(17,6),
(18,4),(18,9),(18,7),
(19,1),(19,8),(19,5),
(20,1),(20,7),
(21,1),(21,10),(21,8),
(22,3);

-- Past stays are paid in full (= fn_booking_total); current stays are part-paid; booking 22 is unpaid.
INSERT INTO PAYMENT (payment_date, amount, booking_id) VALUES
('2026-08-05', 26500.00, 11),
('2026-08-12', 16100.00, 12),
('2026-08-20', 77650.00, 13),
('2026-09-03',  8400.00, 14),
('2026-09-10', 34500.00, 15),
('2026-09-18', 10100.00, 16),
('2026-10-02', 20100.00, 17),
('2026-10-10', 25650.00, 18),
('2026-10-15',  7900.00, 19),
('2026-10-28', 10000.00, 20),
('2026-10-29', 15000.00, 21);
