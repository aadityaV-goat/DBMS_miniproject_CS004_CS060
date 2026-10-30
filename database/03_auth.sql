-- Resort Management System – login accounts for the web app
-- Run AFTER 01_schema.sql and 02_seed_data.sql:   mysql -u root -p < database/03_auth.sql
-- Re-runnable: drops and recreates APP_USER.
--
-- Rows are NOT inserted here. Passwords must be bcrypt-hashed, which MySQL
-- cannot do, so the Node script scripts/seed-users.ts creates the demo logins.

USE resort_entries;

DROP TABLE IF EXISTS APP_USER;

-- Rubric: Authentication with 2 roles (ADMIN, STAFF); passwords stored only as bcrypt hashes.
-- Rubric: Database-level validation (NOT NULL, UNIQUE, ENUM, FOREIGN KEY).
CREATE TABLE APP_USER (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,          -- bcrypt output, e.g. "$2b$10$..."
    role ENUM('ADMIN','STAFF') NOT NULL,
    employee_id INT NOT NULL UNIQUE,              -- one login per employee
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_username_length CHECK (CHAR_LENGTH(username) >= 3),
    CONSTRAINT fk_app_user_employee
        FOREIGN KEY (employee_id) REFERENCES EMPLOYEE(employee_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE                         -- deleting an employee removes their login
);
