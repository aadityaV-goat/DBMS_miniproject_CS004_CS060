#!/usr/bin/env bash
# End-to-end API tests: logs in as ADMIN and STAFF and checks that every rule
# (roles, triggers, constraints, procedure, full-text search, Neo4j) behaves.
#
#   npm run dev          (in one terminal)
#   npm run test:api     (in another)
#
# Rows it creates are deleted again at the end. Needs curl and python3.
set -u
B="${BASE_URL:-http://localhost:3000}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
ADMIN_PW=$(grep '^SEED_ADMIN_PASSWORD=' .env.local | cut -d= -f2-)
STAFF_PW=$(grep '^SEED_STAFF_PASSWORD=' .env.local | cut -d= -f2-)
PASS=0; FAIL=0

# check "name" expected_status method url [json_body] [cookie_jar]
check() {
  local name=$1 want=$2 method=$3 url=$4 body=${5:-} jar=${6:-$TMP/staff}
  local args=(-s -o "$TMP/out" -w '%{http_code}' -b "$jar" -X "$method" "$B$url")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  local got; got=$(curl "${args[@]}")
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf '  PASS  %-55s %s\n' "$name" "$got"
  else FAIL=$((FAIL+1)); printf '  FAIL  %-55s want %s got %s: %s\n' "$name" "$want" "$got" "$(head -c 200 "$TMP/out")"; fi
}
field() { python3 -I -c "import json,sys; print(json.load(open(sys.argv[1]))$1)" "$TMP/out"; }
login() { curl -s -c "$TMP/$1" -o /dev/null -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$2\",\"password\":\"$3\"}"; }

echo "Authentication & roles"
check "no session → 401"                       401 GET  /api/guests "" /dev/null
check "wrong password → 401"                   401 POST /api/auth/login '{"username":"admin","password":"wrong"}' /dev/null
login admin admin "$ADMIN_PW"; login staff reception "$STAFF_PW"
check "staff can list guests"                  200 GET  /api/guests
check "staff blocked from employees (403)"     403 GET  /api/employees
check "staff blocked from reports (403)"       403 GET  /api/reports
check "staff cannot delete a room (403)"       403 DELETE /api/rooms/1
check "staff cannot add a service (403)"       403 POST /api/services '{"service_name":"X","price":1}'
check "staff cannot sync Neo4j (403)"          403 POST /api/graph/sync
check "admin can open reports"                 200 GET  /api/reports "" "$TMP/admin"

echo "Guests (UNIQUE, FK RESTRICT, FULLTEXT)"
check "add guest"                              201 POST /api/guests '{"first_name":"Test","last_name":"Guest","phone":"9000000000","email":"api.test@example.com"}'
GUEST=$(field "['guest_id']")
check "duplicate email rejected (UNIQUE)"      409 POST /api/guests '{"first_name":"X","last_name":"Y","phone":"9000000001","email":"api.test@example.com"}'
check "invalid email rejected"                 400 POST /api/guests '{"first_name":"X","last_name":"Y","phone":"9000000002","email":"nope"}'
check "delete guest with bookings (FK)"        409 DELETE /api/guests/1
check "full-text search 'diy'"                 200 GET  "/api/guests?q=diy"
[ "$(field "[0]['first_name']")" = "Diya" ] && { PASS=$((PASS+1)); echo "  PASS  search returns Diya first"; } || { FAIL=$((FAIL+1)); echo "  FAIL  search did not return Diya first"; }

echo "Rooms (NOT EXISTS availability)"
check "availability for valid dates"           200 GET  "/api/rooms/availability?check_in=2026-11-01&check_out=2026-11-04"
check "availability with check-out before in"  400 GET  "/api/rooms/availability?check_in=2026-11-04&check_out=2026-11-01"
check "admin: duplicate room number (UNIQUE)"  409 POST /api/rooms '{"room_number":"101","floor":1,"type_id":1}' "$TMP/admin"
check "admin: delete room type in use (FK)"    409 DELETE /api/room-types/1 "" "$TMP/admin"

echo "Bookings (procedure + transaction + triggers)"
check "overlapping booking rejected"           409 POST /api/bookings '{"guest_id":3,"room_id":8,"check_in":"2026-11-01","check_out":"2026-11-03"}'
check "over-payment rolled back"               409 POST /api/bookings "{\"guest_id\":$GUEST,\"room_id\":3,\"check_in\":\"2030-01-01\",\"check_out\":\"2030-01-03\",\"payment_amount\":999999}"
check "…and nothing was saved (room still free)" 200 GET "/api/bookings?guest_id=$GUEST"
[ "$(field ".__len__()")" = "0" ] && { PASS=$((PASS+1)); echo "  PASS  rollback left no booking behind"; } || { FAIL=$((FAIL+1)); echo "  FAIL  rollback left a booking behind"; }
check "valid booking via sp_create_booking"    201 POST /api/bookings "{\"guest_id\":$GUEST,\"room_id\":3,\"check_in\":\"2030-01-01\",\"check_out\":\"2030-01-04\",\"service_ids\":[1,3],\"payment_amount\":1000,\"payment_date\":\"2030-01-01\"}"
BOOKING=$(field "['booking_id']")
check "booking detail"                         200 GET  "/api/bookings/$BOOKING"
[ "$(field "['details']['num_nights']")" = "3" ] && { PASS=$((PASS+1)); echo "  PASS  trigger set num_nights = 3"; } || { FAIL=$((FAIL+1)); echo "  FAIL  num_nights not 3"; }
check "same service twice (PRIMARY KEY)"       409 POST "/api/bookings/$BOOKING/services" '{"service_id":1}'
check "move into an occupied room (trigger)"   409 PUT  "/api/bookings/$BOOKING" '{"room_id":8,"check_in":"2026-11-01","check_out":"2026-11-02"}'
check "second payment (UNIQUE booking_id)"     409 POST /api/payments "{\"booking_id\":$BOOKING,\"amount\":10,\"payment_date\":\"2030-01-02\"}"

echo "Reports & Neo4j"
for k in availability guestBookings guestDue occupancy revenue topGuests staffWorkload; do
  check "report $k" 200 GET "/api/reports/$k?check_in=2026-11-01&check_out=2026-11-04&guest_id=2&date=2026-10-30&from=2026-08-01&to=2026-10-31" "" "$TMP/admin"
done
check "Neo4j recommendations (503 = paused)"   200 GET  /api/graph/recommendations/1

echo "Clean-up"
check "cancel test booking (CASCADE)"          200 DELETE "/api/bookings/$BOOKING"
check "delete test guest"                      200 DELETE "/api/guests/$GUEST"

echo; echo "$PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
