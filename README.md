# Resort Management System

DBMS Experiential Learning – Level 3 Project
**Team:** Aaditya Vashisht (PES1UG24CS004) · Ananya Uppili (PES1UG24CS060)

A web application that lets a resort's receptionists and manager run day-to-day operations in one place: guests, rooms, bookings, add-on services, payments and staff. It is built with **Next.js** and uses two databases:

- **MySQL**: the source of truth for all transactional data, with constraints, triggers, views, a stored function and a stored procedure that uses a transaction.
- **Neo4j** (Aura Free): a graph copy of the guest → room → service relationships, used for "guests like you also enjoyed…" recommendations.

---

## Features

| Area | What you can do |
|---|---|
| Login | Two roles: **ADMIN** (manager) and **STAFF** (receptionist). Passwords are bcrypt-hashed, and the session is a signed JWT in an httpOnly cookie. |
| Dashboard | KPI cards, revenue by month, revenue by room type, services used more than once, upcoming arrivals |
| Guests | Full-text search (MySQL `FULLTEXT`), add/edit/delete, a guest page with every bill and Neo4j recommendations |
| Rooms | Availability checker for a date range (`NOT EXISTS`), filters, admin-managed rooms and room types |
| Bookings | New booking through the stored procedure `sp_create_booking` (one transaction); the bill; add/remove services; change dates; cancel |
| Payments | Outstanding balances; record or edit a payment (one per booking, never more than the bill) |
| Services | List with usage; admin add/edit/delete |
| Employees *(admin)* | Employees and their app logins |
| Reports *(admin)* | The "important queries" from the problem statement, each with its exact SQL |
| Guest insights | Neo4j recommendations, similar guests, popular service pairs; admin "Sync from MySQL" button |

STAFF cannot open Employees or Reports, and cannot add, change or delete rooms, room types or services. The API returns **403** if they try, not just a hidden button.

---

## Why two databases?

| Data | Database | Reason |
|---|---|---|
| Guests, rooms, bookings, payments, services, employees, logins | **MySQL** | Fixed structure and strict rules: no double-booked rooms, payments can't exceed the bill, a booking and its services and payment must save together or not at all. This needs foreign keys, CHECK constraints, triggers and transactions. |
| Who stayed where and who used which service | **Neo4j** | Recommendation questions follow chains of relationships: guest → service → other guest → other service. In SQL that means joining `BOOKING_SERVICE` to itself several times. In Cypher it is one path pattern, and adding another hop (for example through room type) is one more arrow. |

MySQL stays the source of truth. Neo4j is a read-only copy that is refreshed by the sync. Re-running the sync is safe because it uses `MERGE` on ids that have uniqueness constraints.

### Graph model

```
(:Guest {guest_id, name, email})
   -[:STAYED_IN {booking_id, check_in, check_out, nights}]->
(:Room {room_id, number, floor})
   -[:OF_TYPE]->
(:RoomType {type_id, name, base_rate})

(:Guest)-[:USED {times}]->(:Service {service_id, name, price})
```

Uniqueness constraints (which also act as indexes): `Guest.guest_id`, `Room.room_id`, `RoomType.type_id`, `Service.service_id`.

**Retrieval:** service recommendations (aggregation by shared-service overlap), most similar guests, popular service pairs, and top services per room type. The queries are in [`lib/queries/graph.ts`](lib/queries/graph.ts).

---

## Advanced database features

| Feature | Where |
|---|---|
| Transaction + stored procedure | `sp_create_booking` in [`database/04_advanced_features.sql`](database/04_advanced_features.sql). It locks the room, checks availability, inserts the booking, services and payment, and uses `COMMIT`/`ROLLBACK`. |
| Stored function | `fn_booking_total(booking_id)` returns room cost + services |
| Triggers | `trg_booking_set_nights_*` (auto `num_nights`, date check), `trg_booking_no_overlap_*` (blocks double bookings), `trg_payment_limit_*` (payment ≤ bill) |
| Views | `v_booking_details`, `v_booking_bill` |
| Indexes | FK indexes from `01_schema.sql`, plus the `FULLTEXT ft_guest_search` index on guest name and email |
| Full-text search | Guest search box: `MATCH … AGAINST (… IN BOOLEAN MODE)` |
| NoSQL aggregation | Cypher `count` / `sum` / `collect` in the Neo4j insights |

---

## Setting it up from scratch (macOS)

### 1. Install the tools

```bash
brew install node mysql git
brew services start mysql
mysql_secure_installation          # choose a root password
```

You can also use the official MySQL installer from mysql.com. Either way you need MySQL 8 or newer and Node.js 20 or newer.

### 2. Get the code

```bash
git clone <this repository's URL> resort-management
cd resort-management
npm install
```

### 3. Create the database

Run the SQL files **in order**. Files 01 and 02 are the original schema and sample data. Files 03–06 add to them.

```bash
mysql -u root -p < database/01_schema.sql
mysql -u root -p < database/02_seed_data.sql
mysql -u root -p < database/03_auth.sql
mysql -u root -p < database/04_advanced_features.sql
mysql -u root -p < database/06_extra_demo_data.sql
```

Then create the app's own MySQL account. Pick a password; you will put the same one in `.env.local`:

```bash
mysql -u root -p -e "SET @app_pw='choose-a-password'; SOURCE database/05_app_user.sql;"
```

This account can only read and write rows and run the procedures. It cannot `DROP` or `ALTER` anything.

> To reset all data later, run 01 → 02 → 03 → 04 → 06 again and then `npm run seed:users`. You don't need to re-run 05.

### 4. Configure secrets

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

- `DB_PASSWORD`: the password you chose for `resort_app` in step 3
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`: from the credentials file Neo4j Aura gives you when you create an instance
- `AUTH_SECRET`: any long random string, for example from `openssl rand -base64 32`
- `SEED_ADMIN_PASSWORD`, `SEED_STAFF_PASSWORD`: the passwords for the two demo logins

`.env.local` is in `.gitignore` and is never committed.

### 5. Create the logins and fill Neo4j

```bash
npm run seed:users     # creates "admin" (ADMIN) and "reception" (STAFF) with bcrypt-hashed passwords
npm run sync:neo4j     # copies MySQL data into Neo4j
```

### 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000> and sign in as `admin` or `reception` with the passwords from step 4. <http://localhost:3000/api/health> shows whether both databases are reachable.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run build` | Production build (also type-checks and lints) |
| `npm run seed:users` | Create or reset the demo logins |
| `npm run sync:neo4j` | Copy MySQL → Neo4j (safe to repeat) |
| `npm run test:api` | 39 end-to-end API tests (needs `npm run dev` running) |

## Testing

`npm run test:api` logs in as both roles and checks:

- Role rules (401/403)
- UNIQUE, FK RESTRICT and CHECK violations
- The overlap and payment triggers
- That a failed `sp_create_booking` leaves nothing behind (rollback)
- `num_nights` being set by the trigger
- Full-text search
- Every report
- Neo4j recommendations

It deletes the rows it creates.

## Troubleshooting

| Problem | Fix |
|---|---|
| Guest insights says it can't reach Neo4j | Aura Free instances pause after a few idle days. Log in at console.neo4j.io and press **Resume**, wait a minute, then reload. |
| `Access denied for user 'resort_app'` | `DB_PASSWORD` in `.env.local` doesn't match the password used with `05_app_user.sql`. Run that step again with the right password. |
| `Missing environment variable …` | Copy `.env.example` to `.env.local` and fill it in, then restart `npm run dev`. |
| Port 3000 in use | Stop the other process, or run `npm run dev -- -p 3001`. |

## Project structure

```
app/(app)/…        pages shown after login (dashboard, guests, rooms, bookings, …)
app/api/…          Route Handlers: the only code that talks to the databases
app/login/         login page
components/        sidebar, tables, forms, toasts, chart
lib/db.ts          MySQL connection pool
lib/neo4j.ts       Neo4j driver
lib/queries/*.ts   all SQL and Cypher, one file per feature
lib/graph/sync.ts  MySQL → Neo4j sync
middleware.ts      login and role checks before every request
database/          SQL scripts, run in numeric order
scripts/           seed-users, sync-neo4j, api-test
docs/              project report and requirements
```

A file-by-file walkthrough is in [`FRONTEND_EXPLAINED.md`](FRONTEND_EXPLAINED.md).

## Team contributions

| Member | Work |
|---|---|
| Ananya Uppili | Database design (ER diagram, relational schema), `01_schema.sql`, `02_seed_data.sql` |
| Aaditya Vashisht | Advanced SQL (`03`–`06`), Next.js application, authentication, Neo4j model and sync |
