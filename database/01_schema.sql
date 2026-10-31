-- Resort Management System: base schema
-- Run first, before 02_seed_data.sql, 03_auth.sql and 04_advanced_features.sql.
-- MySQL 8.0+. This is intended for a FRESH database; it drops existing base tables.

CREATE DATABASE IF NOT EXISTS resort_entries
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE resort_entries;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS BOOKING_SERVICE;
DROP TABLE IF EXISTS PAYMENT;
DROP TABLE IF EXISTS BOOKING;
DROP TABLE IF EXISTS SERVICE;
DROP TABLE IF EXISTS EMPLOYEE;
DROP TABLE IF EXISTS GUEST;
DROP TABLE IF EXISTS ROOM;
DROP TABLE IF EXISTS ROOM_TYPE;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE ROOM_TYPE (
  type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE,
  base_rate DECIMAL(10,2) NOT NULL,
  CHECK (base_rate >= 0)
) ENGINE=InnoDB;

CREATE TABLE ROOM (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL UNIQUE,
  floor INT NOT NULL,
  type_id INT NOT NULL,
  CONSTRAINT fk_room_type FOREIGN KEY (type_id)
    REFERENCES ROOM_TYPE(type_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE GUEST (
  guest_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE EMPLOYEE (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  role VARCHAR(40) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE SERVICE (
  service_id INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(80) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE BOOKING (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_nights INT NOT NULL,
  guest_id INT NOT NULL,
  room_id INT NOT NULL,
  employee_id INT NOT NULL,
  CHECK (check_out > check_in),
  CHECK (num_nights > 0),
  CONSTRAINT fk_booking_guest FOREIGN KEY (guest_id)
    REFERENCES GUEST(guest_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_booking_room FOREIGN KEY (room_id)
    REFERENCES ROOM(room_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_booking_employee FOREIGN KEY (employee_id)
    REFERENCES EMPLOYEE(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_booking_dates (check_in, check_out),
  INDEX idx_booking_guest (guest_id),
  INDEX idx_booking_room (room_id)
) ENGINE=InnoDB;

CREATE TABLE PAYMENT (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  booking_id INT NOT NULL UNIQUE,
  CHECK (amount >= 0),
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id)
    REFERENCES BOOKING(booking_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE BOOKING_SERVICE (
  booking_id INT NOT NULL,
  service_id INT NOT NULL,
  PRIMARY KEY (booking_id, service_id),
  CONSTRAINT fk_booking_service_booking FOREIGN KEY (booking_id)
    REFERENCES BOOKING(booking_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_booking_service_service FOREIGN KEY (service_id)
    REFERENCES SERVICE(service_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
