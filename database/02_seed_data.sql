-- Resort Management System: base demo data
-- Run after 01_schema.sql and before 03_auth.sql / 04_advanced_features.sql.
-- Inserts 10 records in each base table. Explicit IDs make the demo reproducible.
USE resort_entries;
START TRANSACTION;

INSERT INTO ROOM_TYPE (type_id,type_name,base_rate) VALUES
(1,'Standard',2500.00),(2,'Deluxe',4000.00),(3,'Suite',6500.00),
(4,'Family',5500.00),(5,'Ocean View',7000.00),(6,'Garden View',4500.00),
(7,'Executive',8000.00),(8,'Villa',12000.00),(9,'Honeymoon Suite',9500.00),
(10,'Presidential Suite',18000.00);

INSERT INTO ROOM (room_id,room_number,floor,type_id) VALUES
(1,'101',1,1),(2,'102',1,2),(3,'103',1,3),(4,'201',2,4),(5,'202',2,5),
(6,'203',2,6),(7,'301',3,7),(8,'302',3,8),(9,'303',3,9),(10,'401',4,10);

INSERT INTO GUEST (guest_id,first_name,last_name,phone,email) VALUES
(1,'Aarav','Sharma','9876500001','aarav.sharma@example.com'),
(2,'Diya','Rao','9876500002','diya.rao@example.com'),
(3,'Kabir','Nair','9876500003','kabir.nair@example.com'),
(4,'Ananya','Iyer','9876500004','ananya.iyer@example.com'),
(5,'Ishaan','Mehta','9876500005','ishaan.mehta@example.com'),
(6,'Meera','Kapoor','9876500006','meera.kapoor@example.com'),
(7,'Rohan','Das','9876500007','rohan.das@example.com'),
(8,'Sana','Khan','9876500008','sana.khan@example.com'),
(9,'Vivaan','Reddy','9876500009','vivaan.reddy@example.com'),
(10,'Tara','Menon','9876500010','tara.menon@example.com');

INSERT INTO EMPLOYEE (employee_id,first_name,last_name,role,phone,email) VALUES
(1,'Arjun','Rao','MANAGER','9886600001','arjun.rao@resort.example'),
(2,'Nisha','Shetty','RECEPTIONIST','9886600002','nisha.shetty@resort.example'),
(3,'Kiran','Kumar','HOUSEKEEPING','9886600003','kiran.kumar@resort.example'),
(4,'Pooja','Shah','RECEPTIONIST','9886600004','pooja.shah@resort.example'),
(5,'Rahul','Verma','CHEF','9886600005','rahul.verma@resort.example'),
(6,'Sneha','Patil','HOUSEKEEPING','9886600006','sneha.patil@resort.example'),
(7,'Aditya','Joshi','MAINTENANCE','9886600007','aditya.joshi@resort.example'),
(8,'Neha','Rao','RECEPTIONIST','9886600008','neha.rao@resort.example'),
(9,'Manoj','Bhat','SECURITY','9886600009','manoj.bhat@resort.example'),
(10,'Aisha','Fernandes','MANAGER','9886600010','aisha.fernandes@resort.example');

INSERT INTO SERVICE (service_id,service_name,price) VALUES
(1,'Airport Transfer',1200.00),(2,'Breakfast',500.00),(3,'Spa Session',1800.00),
(4,'Laundry',350.00),(5,'Room Service',600.00),(6,'Guided Tour',1500.00),
(7,'Pool Access',300.00),(8,'Extra Bed',900.00),(9,'Dinner Package',1100.00),
(10,'Late Checkout',750.00);

-- No overlapping stays in the same room. These historical dates seed the dashboard.
INSERT INTO BOOKING
(booking_id,check_in,check_out,num_nights,guest_id,room_id,employee_id) VALUES
(1,'2026-09-01','2026-09-03',2,1,1,1),
(2,'2026-09-05','2026-09-08',3,2,2,2),
(3,'2026-09-10','2026-09-12',2,3,3,1),
(4,'2026-09-14','2026-09-18',4,4,4,4),
(5,'2026-09-20','2026-09-23',3,5,5,2),
(6,'2026-09-25','2026-09-27',2,6,6,8),
(7,'2026-10-01','2026-10-04',3,7,7,1),
(8,'2026-10-06','2026-10-10',4,8,8,4),
(9,'2026-10-12','2026-10-14',2,9,9,2),
(10,'2026-10-16','2026-10-20',4,10,10,10);

INSERT INTO BOOKING_SERVICE (booking_id,service_id) VALUES
(1,2),(1,4),(2,1),(2,2),(3,3),(4,5),(4,9),(5,6),(6,2),(6,7),
(7,1),(7,8),(8,3),(8,5),(9,4),(10,1),(10,9);

INSERT INTO PAYMENT (payment_id,payment_date,amount,booking_id) VALUES
(1,'2026-09-01',3000.00,1),(2,'2026-09-05',5000.00,2),
(3,'2026-09-10',5000.00,3),(4,'2026-09-14',8000.00,4),
(5,'2026-09-20',7000.00,5),(6,'2026-09-25',4000.00,6),
(7,'2026-10-01',10000.00,7),(8,'2026-10-06',15000.00,8),
(9,'2026-10-12',6000.00,9),(10,'2026-10-16',20000.00,10);

COMMIT;

SELECT 'ROOM_TYPE' AS table_name,COUNT(*) AS row_count FROM ROOM_TYPE
UNION ALL SELECT 'ROOM',COUNT(*) FROM ROOM
UNION ALL SELECT 'GUEST',COUNT(*) FROM GUEST
UNION ALL SELECT 'EMPLOYEE',COUNT(*) FROM EMPLOYEE
UNION ALL SELECT 'SERVICE',COUNT(*) FROM SERVICE
UNION ALL SELECT 'BOOKING',COUNT(*) FROM BOOKING
UNION ALL SELECT 'BOOKING_SERVICE',COUNT(*) FROM BOOKING_SERVICE
UNION ALL SELECT 'PAYMENT',COUNT(*) FROM PAYMENT;
