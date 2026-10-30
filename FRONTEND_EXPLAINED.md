# How the web app works (viva notes)

This explains the Next.js part of the Resort Management System: what each file does, how a click turns into a database query, which file shows each rubric item, a 5-minute demo script and likely viva questions.

---

## 1. The big picture

```
 Browser (React pages)                Next.js server                         Databases
 ─────────────────────                ───────────────────────────            ─────────────
 app/(app)/bookings/new/page.tsx      middleware.ts                          MySQL
   user clicks "Create booking"  ──►    is there a valid login cookie?  ──►   resort_entries
   fetch POST /api/bookings             is this role allowed here?            (tables, views,
                                      app/api/bookings/route.ts                triggers, procs)
                                        requireRole("ADMIN","STAFF")
                                        zod checks the input
                                        lib/queries/bookings.ts
                                          CALL sp_create_booking(?,?,…)  ──►  runs in ONE transaction
   toast: "Booking #23 created"  ◄──    JSON { booking_id: 23 }         ◄──   OUT @new_booking_id
   or the DB's reason, e.g.             or lib/api.ts turns the MySQL         or SIGNAL / FK / UNIQUE
   "Room is not available…"             error into a friendly message         error + ROLLBACK
```

Rules the whole app follows:

1. **The browser never talks to a database.** Pages only call our own URLs under `/api/...`. Only the server knows the database passwords.
2. **Every SQL statement uses `?` placeholders.** User input is sent separately from the SQL text, so it can't change the query (no SQL injection).
3. **The database is the real validator.** The forms also check input to give quick messages, but the CHECK constraints, UNIQUE, foreign keys and triggers are what actually protect the data. When MySQL says no, its reason is shown in a toast.
4. **Roles are checked on the server twice:** once in `middleware.ts` and again in each API route with `requireRole()`. Hiding buttons is only for convenience.

Neo4j works the same way: page → `/api/graph/...` → `lib/queries/graph.ts` → Cypher.

---

## 2. Folder structure: what every file does

### Configuration
| File | Purpose |
|---|---|
| `.env.example` | Lists every setting, with fake values. Safe to commit. |
| `.env.local` | Real passwords and secrets. **Git-ignored.** |
| `.gitignore` | Keeps `.env.local`, `secrets/`, `node_modules/` and `.next/` out of git |
| `next.config.ts` | Tells Next.js which folder is the project root |
| `middleware.ts` | Runs before every request. Not logged in → `/login` (pages) or 401 (API). STAFF on admin-only routes → redirected home or 403. |

### `database/`
| File | Purpose |
|---|---|
| `01_schema.sql` | Teammate's schema: 8 tables, PK/FK, CHECK, UNIQUE, indexes |
| `02_seed_data.sql` | Teammate's sample data; `ALTER TABLE` adds `num_nights` |
| `03_auth.sql` | `APP_USER` table (username, bcrypt hash, role ENUM, FK to EMPLOYEE) |
| `04_advanced_features.sql` | Triggers, `fn_booking_total`, payment-limit trigger, views, `sp_create_booking`, FULLTEXT index |
| `05_app_user.sql` | Creates the limited MySQL account `resort_app` |
| `06_extra_demo_data.sql` | More stays and services so the charts, HAVING and recommendations have data |

### `lib/`: server logic (and two small browser helpers)
| File | Purpose |
|---|---|
| `db.ts` | MySQL connection pool, plus the `query()` and `execute()` helpers (prepared statements) |
| `neo4j.ts` | Neo4j driver and the `runCypher()` helper |
| `env.ts` | Reads a setting from `.env.local` or fails with a clear message |
| `session.ts` | Creates and verifies the signed JWT login cookie (works in middleware too) |
| `auth.ts` | `getSession()` and `requireRole()` for API routes |
| `api.ts` | Turns MySQL error codes (1062 UNIQUE, 1451/1217 FK, 3819 CHECK, 1644 SIGNAL) into friendly messages; `parseBody()` validation |
| `validation.ts` | zod rules for every form (types, required fields, email format, date format) |
| `queries/*.ts` | **All SQL lives here, one file per feature:** guests, rooms, bookings, payments, services, employees, users, dashboard, reports. `graph.ts` holds the Cypher. |
| `graph/sync.ts` | Copies MySQL → Neo4j with `MERGE`, in one transaction |
| `client.ts` | Browser side: `api()` fetch wrapper, ₹ and date formatting |
| `useApi.ts` | Browser side: React hook that loads `/api/...` data and can reload it |

### `app/api/`: Route Handlers (the backend)
Each `route.ts` exports functions named after HTTP methods (`GET`, `POST`, `PUT`, `DELETE`). Every one starts with `requireRole(...)`, validates input, calls a function from `lib/queries`, and catches database errors.

| Route | Methods | Who |
|---|---|---|
| `/api/auth/login`, `/logout`, `/me` | POST, POST, GET | anyone / logged in |
| `/api/health` | GET | public: checks both databases |
| `/api/dashboard` | GET | both roles |
| `/api/guests`, `/api/guests/:id` | GET POST / GET PUT DELETE | both |
| `/api/rooms`, `/api/rooms/:id` | GET (both), POST PUT DELETE (admin) | |
| `/api/rooms/availability` | GET | both |
| `/api/room-types`, `/:id` | GET (both), POST PUT DELETE (admin) | |
| `/api/bookings`, `/:id`, `/:id/services` | GET POST / GET PUT DELETE / POST DELETE | both |
| `/api/payments`, `/:id` | GET POST / PUT DELETE | both |
| `/api/services`, `/:id` | GET (both), POST PUT DELETE (admin) | |
| `/api/employees`, `/api/users` (+ `/:id`) | all | admin |
| `/api/reports`, `/api/reports/:key` | GET | admin |
| `/api/graph/insights`, `/api/graph/recommendations/:guestId` | GET | both |
| `/api/graph/sync` | POST | admin |

### `app/`: pages
| Page | File | Notes |
|---|---|---|
| `/login` | `app/login/page.tsx` | Form → POST `/api/auth/login`. ADMIN goes to `/dashboard`, STAFF to `/bookings`. |
| layout | `app/(app)/layout.tsx` | Sidebar + page area. `(app)` is a *route group*, so it doesn't appear in the URL. |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | KPIs, two bar charts, HAVING table, arrivals |
| `/guests`, `/guests/:id` | `app/(app)/guests/…` | Search, CRUD, bills, Neo4j panel |
| `/rooms` | `app/(app)/rooms/page.tsx` | Availability checker, rooms, room types |
| `/bookings`, `/bookings/new`, `/bookings/:id` | `app/(app)/bookings/…` | List + filters, new booking (procedure), detail |
| `/payments` | `app/(app)/payments/page.tsx` | Outstanding balances, all payments |
| `/services` | `app/(app)/services/page.tsx` | List, admin CRUD |
| `/employees` | `app/(app)/employees/page.tsx` | Admin: employees and logins |
| `/reports` | `app/(app)/reports/page.tsx` | Admin: 7 reports, each with its SQL |
| `/graph` | `app/(app)/graph/page.tsx` | Neo4j insights and the sync button |

### `components/`
| File | Purpose |
|---|---|
| `ui.tsx` | Button, Card, Table, Modal, Field, Input, Select, Badge, Stat, SqlBox ("Show SQL") |
| `Sidebar.tsx` | Navigation; hides admin links for STAFF |
| `Toast.tsx` | Success and error pop-ups |
| `SessionContext.tsx` | Lets pages know the user's role (for showing or hiding buttons) |
| `BarChart.tsx` | Simple CSS bar chart with hover values |
| `GuestForm.tsx`, `PaymentForm.tsx` | Reused forms |
| `Recommendations.tsx` | Neo4j "Recommended for this guest" panel |
| `DeniedNotice.tsx`, `LogoutButton.tsx` | Small helpers |

### `scripts/`
| File | Purpose |
|---|---|
| `seed-users.ts` | `npm run seed:users`: bcrypt-hashes the demo passwords into APP_USER |
| `sync-neo4j.ts` | `npm run sync:neo4j`: same sync as the admin button |
| `api-test.sh` | `npm run test:api`: 39 end-to-end checks |

---

## 3. Rubric → where it is shown

| # | Requirement | Where to point |
|---|---|---|
| 3 | SQL + NoSQL | MySQL (`database/`), Neo4j (`lib/graph/sync.ts`, `/graph`) |
| 4 | ER → relational schema, keys, constraints | `docs/DBMS_Project.pdf`, `01_schema.sql`; NoSQL model in README "Graph model" |
| 5 | CREATE / ALTER / DROP | `01` (CREATE, DROP IF EXISTS), `02` (ALTER TABLE … ADD num_nights), `04` (CREATE VIEW/TRIGGER/PROCEDURE, ALTER TABLE ADD FULLTEXT) |
| 5 | Keys, constraints, indexes, views | `01`, `03`, `04`; views used by `/bookings`, `/payments`, `/guests/:id` |
| 6 | INSERT / UPDATE / DELETE / SELECT from the UI | every page: add, edit and delete guests, rooms, services, payments, employees; cancel bookings |
| 6 | JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subqueries | Dashboard ("Show SQL" under each block), `/reports` (7 queries), `lib/queries/*.ts` |
| 7 | Transactions | `sp_create_booking` (START TRANSACTION / COMMIT / ROLLBACK), used by `/bookings/new` |
| 7 | Stored procedure / function | `sp_create_booking`; `fn_booking_total` (booking page "Bill" card, report 3) |
| 7 | Triggers | overlap, num_nights and payment-limit triggers; try a clash on `/bookings/:id` → "Change dates / room" |
| 7 | Indexing + full-text search | `ft_guest_search`; `/guests` search box (`lib/queries/guests.ts`) |
| 7 | NoSQL aggregation | `/graph`, `lib/queries/graph.ts` (count, sum, collect) |
| 9 | Next.js UI: forms, tables, search, filters, dashboard | all pages |
| 10 | API layer, no hard-coded credentials, env vars | `app/api/**`, `lib/db.ts`, `.env.example` |
| 11 | Auth, 2+ roles | `/login`, `middleware.ts`, `lib/auth.ts`; log in as `reception` and open `/employees` |
| 12 | DB-level validation, integrity | CHECK, UNIQUE, FK, triggers → friendly messages from `lib/api.ts` |
| 13 | Security: no plain-text passwords or credentials | bcrypt hashes in APP_USER, `.env.local` ignored, `resort_app` limited account, `?` placeholders, httpOnly cookie |
| 15 | Git + README | commit history, `README.md` |
| 16 | Test cases | `npm run test:api` (39 checks) |
| 18 | Justified DB choice | README "Why two databases?" and the card at the bottom of `/graph` |

---

## 4. Demo logins

| Username | Role | Employee | Password (local demo) |
|---|---|---|---|
| `admin` | ADMIN | Rohan Das, Manager | `Admin@2026` |
| `reception` | STAFF | Kavya Menon, Receptionist | `Reception@2026` |

The passwords come from `SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` in `.env.local`. The database only stores bcrypt hashes. To change them, edit `.env.local` and run `npm run seed:users`.

---

## 5. Five-minute demo script

**Before you start:** check that Neo4j isn't paused (open `/graph`), run `npm run dev`, and have two browser windows ready (one normal, one private).

1. **(30 s) Problem and design.** "Receptionists and the manager handle guests, bookings, services and payments. MySQL holds the transactional data; Neo4j holds the relationships we use for recommendations." Show the ER diagram in `docs/DBMS_Project.pdf`.
2. **(30 s) Roles.** Log in as `reception` in the private window and show that Employees and Reports aren't in the menu. Type `/employees` in the address bar: you get redirected with "admins only". Log in as `admin` in the other window.
3. **(45 s) Dashboard.** Point at the KPIs and the two charts. Open **Show SQL** under "Services used more than once" to show the HAVING clause.
4. **(45 s) Guests.** Type `pri` in the search box (FULLTEXT `MATCH … AGAINST`). Try to add a guest with `priya@example.com`: the UNIQUE message appears. Delete Aarav: "This guest has bookings…" (FK RESTRICT). Open Priya's page to show her bills and the Neo4j recommendations.
5. **(60 s) New booking, the key moment.** On Rooms, use the availability checker for 1–4 Nov and open Show SQL (NOT EXISTS). Click **Book →**. Pick Rahul, add Spa and Room Service, and enter a payment of 999999. Create it: "Payment … is more than the booking total". Explain that the procedure rolled back, so not even the booking was saved. Change the payment to 1000 and create it again. Show the detail page: nights were filled in by the trigger, and the bill comes from the view and the function.
6. **(30 s) Trigger on update.** On that booking, click **Change dates / room** and move it into room 101 for 1–3 Nov: "This room is already booked … clashes with booking #1."
7. **(30 s) Reports.** Run report 3 (guest total with services) and report 5 (revenue with ROLLUP), each with its SQL.
8. **(30 s) Neo4j.** On `/graph`, press **Sync from MySQL**. Show the recommendations for a guest and the Cypher behind them. Explain why this is easier in a graph.
9. **(Optional) Tests.** Run `npm run test:api` in a terminal: 39 passed.

Afterwards, cancel the demo booking, or reset the data with the steps in the README.

---

## 6. Likely viva questions

1. **Why do pages call `/api/...` instead of querying MySQL directly?**
   The database password must never reach the browser. Route Handlers run only on the server, read credentials from `.env.local`, check the user's role, and return just the data the page needs.

2. **How do you prevent SQL injection?**
   Every query uses `?` placeholders through `mysql2`'s `execute()`. MySQL receives the SQL text and the values separately, so a value like `' OR 1=1 --` is treated as plain text, not as SQL.

3. **How are passwords stored?**
   As bcrypt hashes (cost 10) in `APP_USER.password_hash`. At login, `bcrypt.compare` hashes the typed password with the stored salt and compares the results. A wrong username and a wrong password give the same message and take the same time, so nobody can tell which usernames exist.

4. **How do roles work, and what stops STAFF from calling the admin API directly?**
   The role is inside a signed JWT in an httpOnly cookie. `middleware.ts` checks it before every request, and each API route checks it again with `requireRole("ADMIN")`. Changing the role inside the cookie breaks the signature. Hidden buttons are only a convenience.

5. **What does `sp_create_booking` do, and why a transaction?**
   It locks the room row (`SELECT … FOR UPDATE`), checks the room is free, inserts the booking, each selected service and the optional payment, then commits. If any step fails (clash, unknown service, over-payment), the EXIT HANDLER runs `ROLLBACK` and passes the error back up with `RESIGNAL`, so there is never a booking without its services, or a half-saved payment.

6. **How do you stop double bookings?**
   Two stays overlap when `existing.check_in < new.check_out AND existing.check_out > new.check_in`. The BEFORE INSERT and BEFORE UPDATE triggers on BOOKING run this check and `SIGNAL` an error. This holds even for SQL typed directly into MySQL, not only through the app.

7. **Why a view (`v_booking_bill`) and also a function (`fn_booking_total`)?**
   The view gives the whole bill for many bookings at once, for lists and reports. The function gives one booking's total inside other SQL, for example in the payment-limit trigger and report 3. The booking page shows both so you can see they agree.

8. **Why Neo4j? Couldn't SQL do recommendations?**
   It could, but "guests who used what you used also used…" means BOOKING → BOOKING_SERVICE → other BOOKING_SERVICE → other BOOKING → BOOKING_SERVICE, which is several self-joins. In Cypher it is one readable path, `(me)-[:USED]->(s)<-[:USED]-(other)-[:USED]->(rec)`, and adding a hop such as room type is one more arrow. MySQL remains the source of truth; Neo4j is a copy refreshed by the sync.

9. **How does the sync avoid duplicates if you run it twice?**
   It uses `MERGE` (find or create) on ids that have uniqueness constraints, rebuilds the STAYED_IN and USED relationships, deletes nodes whose rows were deleted in MySQL, and does all of this in one Neo4j transaction.

10. **What happens when a constraint fails? Does the app crash?**
    No. The API catches the MySQL error and `lib/api.ts` maps its code to a message: 1062 → "already used", 1451/1217 → "still in use", 3819 → which CHECK failed, 1644 → our trigger's own message. The page shows it as a red toast.

Extra questions you might get:
- *What is the FULLTEXT index for?* Fast word search on name and email. Words shorter than 3 letters aren't indexed, so the code falls back to `LIKE` for those.
- *Why is there a separate MySQL user?* Least privilege: `resort_app` can only SELECT, INSERT, UPDATE, DELETE and EXECUTE on `resort_entries`. A bug in the app couldn't DROP a table.
- *Why `ON DELETE CASCADE` for payments but `RESTRICT` for guests?* A payment means nothing without its booking, so it goes with it. A guest with history must not vanish silently, so the database refuses.
