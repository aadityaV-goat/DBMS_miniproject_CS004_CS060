-- Resort Management System – advanced SQL features
-- Run AFTER 01, 02 and 03:   mysql -u root -p < database/04_advanced_features.sql
-- Re-runnable: every object is dropped (or replaced) before it is created.
--
-- Contents
--   1. Triggers on BOOKING   (auto num_nights, block overlapping bookings)
--   2. Stored function       fn_booking_total
--   3. Trigger on PAYMENT    (payment cannot exceed the bill)
--   4. Views                 v_booking_details, v_booking_bill
--   5. Stored procedure      sp_create_booking (uses a TRANSACTION)
--   6. FULLTEXT index        on GUEST for the search box

USE resort_entries;

-- ---------------------------------------------------------------------------
-- 1. TRIGGERS ON BOOKING
-- Rubric 7: Triggers.  Rubric 12: validation at the database level.
-- MySQL 8 allows several triggers per event; FOLLOWS fixes their order so the
-- dates are checked (and num_nights set) before the overlap check runs.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_booking_set_nights_bi;
DROP TRIGGER IF EXISTS trg_booking_set_nights_bu;
DROP TRIGGER IF EXISTS trg_booking_no_overlap_bi;
DROP TRIGGER IF EXISTS trg_booking_no_overlap_bu;

DELIMITER $$

-- (b) num_nights is always derived from the dates, so it can never disagree with them.
CREATE TRIGGER trg_booking_set_nights_bi
BEFORE INSERT ON BOOKING
FOR EACH ROW
BEGIN
    IF NEW.check_out <= NEW.check_in THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Check-out date must be after the check-in date.';
    END IF;
    SET NEW.num_nights = DATEDIFF(NEW.check_out, NEW.check_in);
END$$

CREATE TRIGGER trg_booking_set_nights_bu
BEFORE UPDATE ON BOOKING
FOR EACH ROW
BEGIN
    IF NEW.check_out <= NEW.check_in THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Check-out date must be after the check-in date.';
    END IF;
    SET NEW.num_nights = DATEDIFF(NEW.check_out, NEW.check_in);
END$$

-- (a) Two stays in the same room overlap when each one starts before the other ends.
--     Check-out day = next guest's check-in day is allowed (strict < and >).
CREATE TRIGGER trg_booking_no_overlap_bi
BEFORE INSERT ON BOOKING
FOR EACH ROW
FOLLOWS trg_booking_set_nights_bi
BEGIN
    DECLARE v_clash INT DEFAULT NULL;
    DECLARE v_msg VARCHAR(255);

    SELECT booking_id INTO v_clash
    FROM BOOKING
    WHERE room_id = NEW.room_id
      AND check_in < NEW.check_out
      AND check_out > NEW.check_in
    LIMIT 1;

    IF v_clash IS NOT NULL THEN
        SET v_msg = CONCAT('This room is already booked for those dates (clashes with booking #', v_clash, ').');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

CREATE TRIGGER trg_booking_no_overlap_bu
BEFORE UPDATE ON BOOKING
FOR EACH ROW
FOLLOWS trg_booking_set_nights_bu
BEGIN
    DECLARE v_clash INT DEFAULT NULL;
    DECLARE v_msg VARCHAR(255);

    SELECT booking_id INTO v_clash
    FROM BOOKING
    WHERE room_id = NEW.room_id
      AND booking_id <> NEW.booking_id        -- a booking never clashes with itself
      AND check_in < NEW.check_out
      AND check_out > NEW.check_in
    LIMIT 1;

    IF v_clash IS NOT NULL THEN
        SET v_msg = CONCAT('This room is already booked for those dates (clashes with booking #', v_clash, ').');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 2. STORED FUNCTION
-- Rubric 7: Stored procedures/functions.
-- Total bill for one booking = nights x room-type rate + sum of add-on services.
-- Returns NULL if the booking does not exist.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_booking_total;

DELIMITER $$

CREATE FUNCTION fn_booking_total(p_booking_id INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_room_cost DECIMAL(12,2);
    DECLARE v_services DECIMAL(12,2);

    -- A scalar subquery gives NULL (not an error) when no row matches.
    SET v_room_cost = (
        SELECT b.num_nights * rt.base_rate
        FROM BOOKING b
        JOIN ROOM r       ON r.room_id  = b.room_id
        JOIN ROOM_TYPE rt ON rt.type_id = r.type_id
        WHERE b.booking_id = p_booking_id
    );
    IF v_room_cost IS NULL THEN
        RETURN NULL;
    END IF;

    SET v_services = (
        SELECT COALESCE(SUM(s.price), 0)
        FROM BOOKING_SERVICE bs
        JOIN SERVICE s ON s.service_id = bs.service_id
        WHERE bs.booking_id = p_booking_id
    );

    RETURN v_room_cost + v_services;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS ON PAYMENT
-- Rubric 7: Triggers.  Rubric 12: data consistency.
-- A payment may not be larger than what the booking costs (uses fn_booking_total).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_payment_limit_bi;
DROP TRIGGER IF EXISTS trg_payment_limit_bu;

DELIMITER $$

CREATE TRIGGER trg_payment_limit_bi
BEFORE INSERT ON PAYMENT
FOR EACH ROW
BEGIN
    DECLARE v_total DECIMAL(12,2);
    DECLARE v_msg VARCHAR(255);
    SET v_total = fn_booking_total(NEW.booking_id);
    IF v_total IS NOT NULL AND NEW.amount > v_total THEN
        SET v_msg = CONCAT('Payment of ', NEW.amount, ' is more than the booking total of ', v_total, '.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

CREATE TRIGGER trg_payment_limit_bu
BEFORE UPDATE ON PAYMENT
FOR EACH ROW
BEGIN
    DECLARE v_total DECIMAL(12,2);
    DECLARE v_msg VARCHAR(255);
    SET v_total = fn_booking_total(NEW.booking_id);
    IF v_total IS NOT NULL AND NEW.amount > v_total THEN
        SET v_msg = CONCAT('Payment of ', NEW.amount, ' is more than the booking total of ', v_total, '.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 4. VIEWS
-- Rubric 5 & 7: Views.  Rubric 6: JOIN, GROUP BY, aggregate functions, subquery.
-- ---------------------------------------------------------------------------

-- One readable row per booking: who, which room, what type, handled by whom.
CREATE OR REPLACE VIEW v_booking_details AS
SELECT
    b.booking_id,
    b.check_in,
    b.check_out,
    b.num_nights,
    g.guest_id,
    CONCAT(g.first_name, ' ', g.last_name) AS guest_name,
    g.phone  AS guest_phone,
    g.email  AS guest_email,
    r.room_id,
    r.room_number,
    r.floor,
    rt.type_id,
    rt.type_name,
    rt.base_rate,
    e.employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.role AS employee_role
FROM BOOKING b
JOIN GUEST g      ON g.guest_id    = b.guest_id
JOIN ROOM r       ON r.room_id     = b.room_id
JOIN ROOM_TYPE rt ON rt.type_id    = r.type_id
JOIN EMPLOYEE e   ON e.employee_id = b.employee_id;

-- The bill for each booking. Services are summed in a derived table first so
-- that joining them does not multiply the room cost or the payment.
CREATE OR REPLACE VIEW v_booking_bill AS
SELECT
    b.booking_id,
    b.guest_id,
    CONCAT(g.first_name, ' ', g.last_name)            AS guest_name,
    b.room_id,
    r.room_number,
    rt.type_name,
    b.check_in,
    b.check_out,
    b.num_nights,
    rt.base_rate,
    b.num_nights * rt.base_rate                       AS room_cost,
    COALESCE(s.service_count, 0)                      AS service_count,
    COALESCE(s.services_total, 0)                     AS services_total,
    b.num_nights * rt.base_rate
        + COALESCE(s.services_total, 0)               AS total_amount,
    COALESCE(p.amount, 0)                             AS amount_paid,
    b.num_nights * rt.base_rate
        + COALESCE(s.services_total, 0)
        - COALESCE(p.amount, 0)                       AS balance_due
FROM BOOKING b
JOIN GUEST g      ON g.guest_id = b.guest_id
JOIN ROOM r       ON r.room_id  = b.room_id
JOIN ROOM_TYPE rt ON rt.type_id = r.type_id
LEFT JOIN (
    SELECT bs.booking_id,
           COUNT(*)     AS service_count,
           SUM(sv.price) AS services_total
    FROM BOOKING_SERVICE bs
    JOIN SERVICE sv ON sv.service_id = bs.service_id
    GROUP BY bs.booking_id
) s ON s.booking_id = b.booking_id
LEFT JOIN PAYMENT p ON p.booking_id = b.booking_id;

-- ---------------------------------------------------------------------------
-- 5. STORED PROCEDURE WITH A TRANSACTION
-- Rubric 7: Transactions + Stored procedures.
-- Creates a booking, its add-on services and (optionally) a payment as ONE
-- unit of work: if any step fails, ROLLBACK undoes all of them.
--
--   p_service_ids    comma-separated service ids, e.g. '1,3,7'  (NULL or '' = none)
--   p_payment_amount NULL or 0 = no payment yet
--   p_payment_date   NULL = today
--   p_booking_id     OUT: id of the new booking
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_create_booking;

DELIMITER $$

CREATE PROCEDURE sp_create_booking(
    IN  p_guest_id       INT,
    IN  p_room_id        INT,
    IN  p_employee_id    INT,
    IN  p_check_in       DATE,
    IN  p_check_out      DATE,
    IN  p_service_ids    VARCHAR(255),
    IN  p_payment_amount DECIMAL(10,2),
    IN  p_payment_date   DATE,
    OUT p_booking_id     INT
)
BEGIN
    DECLARE v_room_found INT DEFAULT NULL;
    DECLARE v_rest VARCHAR(255);
    DECLARE v_sid  VARCHAR(20);

    -- Any error below (ours or MySQL's): undo everything, then pass the
    -- original error message on to the caller (the web app shows it).
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_booking_id = NULL;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Lock the room row so two people booking the same room at the same
    -- moment are handled one after the other, not both accepted.
    SELECT room_id INTO v_room_found
    FROM ROOM WHERE room_id = p_room_id
    FOR UPDATE;

    IF v_room_found IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That room does not exist.';
    END IF;

    -- Availability check (NOT EXISTS subquery). The trigger would also catch
    -- this, but checking here gives a clearer message for the booking form.
    IF p_check_out > p_check_in AND EXISTS (
        SELECT 1 FROM BOOKING
        WHERE room_id = p_room_id
          AND check_in < p_check_out
          AND check_out > p_check_in
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is not available for the selected dates.';
    END IF;

    -- num_nights is filled in by trg_booking_set_nights_bi.
    INSERT INTO BOOKING (check_in, check_out, guest_id, room_id, employee_id)
    VALUES (p_check_in, p_check_out, p_guest_id, p_room_id, p_employee_id);

    SET p_booking_id = LAST_INSERT_ID();

    -- Walk through the comma-separated list of service ids.
    SET v_rest = TRIM(COALESCE(p_service_ids, ''));
    WHILE v_rest <> '' DO
        SET v_sid  = TRIM(SUBSTRING_INDEX(v_rest, ',', 1));
        SET v_rest = IF(LOCATE(',', v_rest) > 0,
                        TRIM(SUBSTRING(v_rest, LOCATE(',', v_rest) + 1)),
                        '');
        IF v_sid <> '' THEN
            INSERT INTO BOOKING_SERVICE (booking_id, service_id)
            VALUES (p_booking_id, CAST(v_sid AS UNSIGNED));
        END IF;
    END WHILE;

    -- Payment last, so trg_payment_limit_bi compares against the full bill.
    IF p_payment_amount IS NOT NULL AND p_payment_amount > 0 THEN
        INSERT INTO PAYMENT (payment_date, amount, booking_id)
        VALUES (COALESCE(p_payment_date, CURDATE()), p_payment_amount, p_booking_id);
    END IF;

    COMMIT;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 6. FULLTEXT INDEX
-- Rubric 5 & 7: Indexing + Full-text search.
-- Used by the guest search box:
--   SELECT * FROM GUEST
--   WHERE MATCH(first_name, last_name, email) AGAINST ('pri*' IN BOOLEAN MODE);
-- MySQL has no "DROP INDEX IF EXISTS", so we look it up first to stay re-runnable.
-- ---------------------------------------------------------------------------
SET @drop_ft = (
    SELECT IF(COUNT(*) > 0, 'ALTER TABLE GUEST DROP INDEX ft_guest_search', 'DO 0')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'GUEST'
      AND index_name   = 'ft_guest_search'
);
PREPARE stmt FROM @drop_ft;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE GUEST ADD FULLTEXT INDEX ft_guest_search (first_name, last_name, email);
