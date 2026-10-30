-- Resort Management System – dedicated MySQL account for the web app
-- Rubric 13: Security. The app never logs in as root; this account can only
-- read/write rows and run our procedures in resort_entries. It cannot DROP,
-- ALTER or CREATE anything, and cannot touch other databases.
--
-- The password is NOT written in this file (it would end up on GitHub).
-- Pass it in when you run the script, using the same value as DB_PASSWORD in .env.local:
--
--   mysql -u root -p -e "SET @app_pw='your-password-here'; SOURCE database/05_app_user.sql;"
--
-- Re-runnable: drops the account first.

DROP USER IF EXISTS 'resort_app'@'localhost';

-- CREATE USER cannot take a variable directly, so build the statement as text.
-- QUOTE() escapes the password safely.
SET @create_user = CONCAT("CREATE USER 'resort_app'@'localhost' IDENTIFIED BY ", QUOTE(@app_pw));
PREPARE stmt FROM @create_user;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Least privilege: DML on our tables/views + EXECUTE for fn_booking_total and sp_create_booking.
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON resort_entries.* TO 'resort_app'@'localhost';

SHOW GRANTS FOR 'resort_app'@'localhost';
