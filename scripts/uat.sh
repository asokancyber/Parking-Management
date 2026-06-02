#!/bin/bash
# Full UAT for ParkSphere — exercises every flow + reports pass/fail.
# Requires the API running on localhost:4000.
set -u
API="http://localhost:4000/api/v1"
PASS=0
FAIL=0
WARN=0
declare -a FAILED

check() {
  local name="$1"; local actual="$2"; local expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf "  ok    %-50s  (%s)\n" "$name" "$actual"
    PASS=$((PASS+1))
  else
    printf "  FAIL  %-50s  expected %s got %s\n" "$name" "$expected" "$actual"
    FAIL=$((FAIL+1))
    FAILED+=("$name :: expected $expected got $actual")
  fi
}
warn() {
  printf "  WARN  %-50s  %s\n" "$1" "$2"
  WARN=$((WARN+1))
}
hdr() { echo ""; echo "-- $1 --"; }

# ----- AUTH -----
hdr "AUTH"
ADMIN_TOKEN=$(curl -s -X POST $API/auth/login -H "content-type: application/json" -d "{\"email\":\"admin@parksphere.local\",\"password\":\"parksphere-admin\"}" | grep -oE "\"token\":\"[^\"]+" | sed "s/\"token\":\"//")
if [ -n "$ADMIN_TOKEN" ]; then check "Admin login" "ok" "ok"; else check "Admin login" "fail" "ok"; fi

ME=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/auth/me)
if echo "$ME" | grep -q "\"role\":\"ADMIN\""; then check "Admin /auth/me role=ADMIN" "ok" "ok"; else check "Admin /auth/me" "fail" "ok"; fi

# ----- DRIVER LIFECYCLE -----
hdr "DRIVER LIFECYCLE"
SUFFIX=$(date +%s | tail -c 5)
PHONE="+60127${SUFFIX}"
PLATE="UAT${SUFFIX}"
EMAIL="uat-${SUFFIX}@parksphere.local"

CREATE=$(curl -s -X POST $API/drivers -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"fullName\":\"UAT Driver\",\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"vehiclePlate\":\"$PLATE\",\"vehicleType\":\"CAR\"}")
DRIVER_ID=$(echo "$CREATE" | grep -oE "\"id\":\"[^\"]+" | head -1 | sed "s/\"id\":\"//")
TEMP_PASS=$(echo "$CREATE" | grep -oE "\"tempPassword\":\"[^\"]+" | sed "s/\"tempPassword\":\"//")
if [ -n "$DRIVER_ID" ]; then check "Create driver (no password)" "ok" "ok"; else check "Create driver" "fail" "ok"; fi
if [ -n "$TEMP_PASS" ]; then check "Auto-generated temp password returned" "ok" "ok"; else check "Temp password" "missing" "present"; fi

RC=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $API/drivers/$DRIVER_ID -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{\"company\":\"UAT Corp\"}")
check "Edit driver" "$RC" "200"

SEARCH=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/drivers?search=$PLATE")
if echo "$SEARCH" | grep -q "$PLATE"; then check "Driver search by plate finds it" "ok" "ok"; else check "Driver search by plate" "fail" "ok"; fi

# ----- DRIVER PORTAL -----
hdr "DRIVER PORTAL"
DRIVER_TOKEN=$(curl -s -X POST $API/auth/login-driver -H "content-type: application/json" -d "{\"plate\":\"$PLATE\",\"password\":\"$TEMP_PASS\"}" | grep -oE "\"token\":\"[^\"]+" | sed "s/\"token\":\"//")
if [ -n "$DRIVER_TOKEN" ]; then check "Driver login by plate+temp" "ok" "ok"; else check "Driver login" "fail" "ok"; fi

DME=$(curl -s -H "Authorization: Bearer $DRIVER_TOKEN" $API/auth/me)
if echo "$DME" | grep -q "\"forceChangePassword\":true"; then check "forceChangePassword=true on first login" "ok" "ok"; else check "forceChangePassword" "false" "true"; fi

NEW_PASS="UATp@ss12345"
RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/auth/change-password -H "Authorization: Bearer $DRIVER_TOKEN" -H "content-type: application/json" -d "{\"currentPassword\":\"$TEMP_PASS\",\"newPassword\":\"$NEW_PASS\"}")
check "Driver self-changes password" "$RC" "201"

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/auth/login-driver -H "content-type: application/json" -d "{\"plate\":\"$PLATE\",\"password\":\"$TEMP_PASS\"}")
check "Old temp password rejected" "$RC" "401"

DRIVER_TOKEN=$(curl -s -X POST $API/auth/login-driver -H "content-type: application/json" -d "{\"plate\":\"$PLATE\",\"password\":\"$NEW_PASS\"}" | grep -oE "\"token\":\"[^\"]+" | sed "s/\"token\":\"//")
if [ -n "$DRIVER_TOKEN" ]; then check "New password works" "ok" "ok"; else check "New password works" "fail" "ok"; fi

DME=$(curl -s -H "Authorization: Bearer $DRIVER_TOKEN" $API/auth/me)
if echo "$DME" | grep -q "\"forceChangePassword\":false"; then check "forceChangePassword cleared" "ok" "ok"; else check "forceChangePassword cleared" "fail" "ok"; fi

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/auth/change-password -H "Authorization: Bearer $DRIVER_TOKEN" -H "content-type: application/json" -d "{\"currentPassword\":\"$NEW_PASS\",\"newPassword\":\"weak\"}")
check "Weak password rejected" "$RC" "400"

# ----- ADMIN PASSWORD ACTIONS -----
hdr "ADMIN PASSWORD ACTIONS"
RESET=$(curl -s -X POST $API/drivers/$DRIVER_ID/reset-password -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{\"reason\":\"UAT\"}")
RESET_TEMP=$(echo "$RESET" | grep -oE "\"tempPassword\":\"[^\"]+" | sed "s/\"tempPassword\":\"//")
if [ -n "$RESET_TEMP" ]; then check "Admin reset returns new temp" "ok" "ok"; else check "Reset" "fail" "ok"; fi

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/auth/login-driver -H "content-type: application/json" -d "{\"plate\":\"$PLATE\",\"password\":\"$NEW_PASS\"}")
check "Old password rejected after reset" "$RC" "401"

RESET_TOKEN=$(curl -s -X POST $API/auth/login-driver -H "content-type: application/json" -d "{\"plate\":\"$PLATE\",\"password\":\"$RESET_TEMP\"}" | grep -oE "\"token\":\"[^\"]+" | sed "s/\"token\":\"//")
DME=$(curl -s -H "Authorization: Bearer $RESET_TOKEN" $API/auth/me)
if echo "$DME" | grep -q "\"forceChangePassword\":true"; then check "Reset re-arms forceChangePassword" "ok" "ok"; else check "forceChange after reset" "fail" "ok"; fi

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/drivers/$DRIVER_ID/lock -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{\"reason\":\"UAT\"}")
check "Lock account" "$RC" "201"

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/auth/login-driver -H "content-type: application/json" -d "{\"plate\":\"$PLATE\",\"password\":\"$RESET_TEMP\"}")
check "Locked driver cannot log in" "$RC" "403"

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/drivers/$DRIVER_ID/unlock -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{}")
check "Unlock account" "$RC" "201"

# ----- SUBSCRIPTION + CARD -----
hdr "SUBSCRIPTION + CARD"
SUB=$(curl -s -X POST $API/subscriptions -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"driverId\":\"$DRIVER_ID\",\"planName\":\"UAT Monthly\",\"priceCents\":10000,\"durationDays\":30}")
SUB_ID=$(echo "$SUB" | grep -oE "\"id\":\"[^\"]+" | head -1 | sed "s/\"id\":\"//")
if [ -n "$SUB_ID" ]; then check "Create subscription" "ok" "ok"; else check "Create sub" "fail" "ok"; fi

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/subscriptions/$SUB_ID/extend -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{\"days\":7}")
check "Extend subscription" "$RC" "201"

RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/subscriptions/$SUB_ID/renew -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{\"paymentRef\":\"UAT-REF\"}")
check "Renew subscription" "$RC" "201"

CARD_UID="UATC${SUFFIX}"
CARD=$(curl -s -X POST $API/cards -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"uid\":\"$CARD_UID\",\"driverId\":\"$DRIVER_ID\",\"label\":\"UAT card\"}")
CARD_ID=$(echo "$CARD" | grep -oE "\"id\":\"[^\"]+" | head -1 | sed "s/\"id\":\"//")
if [ -n "$CARD_ID" ]; then check "Issue card to driver" "ok" "ok"; else check "Issue card" "fail" "ok"; fi

# Gate access tests
GATE_TOKEN=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/gates | grep -oE "\"accessToken\":\"[^\"]+" | head -1 | sed "s/\"accessToken\":\"//")
TAP=$(curl -s -X POST $API/card-access/tap -H "Authorization: Bearer $GATE_TOKEN" -H "content-type: application/json" -d "{\"cardUid\":\"$CARD_UID\"}")
if echo "$TAP" | grep -q "\"granted\":true"; then check "Granted tap (active card)" "ok" "ok"; else check "Granted tap" "fail" "ok"; fi

TAP=$(curl -s -X POST $API/card-access/tap -H "Authorization: Bearer $GATE_TOKEN" -H "content-type: application/json" -d "{\"cardUid\":\"DEADBEEF\"}")
if echo "$TAP" | grep -q "DENIED_CARD_UNKNOWN"; then check "Unknown card denied" "ok" "ok"; else check "Unknown card denied" "fail" "ok"; fi

RC=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $API/cards/$CARD_ID/status -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d "{\"status\":\"BLACKLISTED\"}")
check "Blacklist card" "$RC" "200"

TAP=$(curl -s -X POST $API/card-access/tap -H "Authorization: Bearer $GATE_TOKEN" -H "content-type: application/json" -d "{\"cardUid\":\"$CARD_UID\"}")
if echo "$TAP" | grep -q "DENIED_CARD_BLACKLISTED"; then check "Blacklisted card denied" "ok" "ok"; else check "Blacklisted denial" "fail" "ok"; fi

SEED_TAP=$(curl -s -X POST $API/card-access/tap -H "Authorization: Bearer $GATE_TOKEN" -H "content-type: application/json" -d "{\"cardUid\":\"04D3E882\"}")
if echo "$SEED_TAP" | grep -qE "DENIED_SUBSCRIPTION_(EXPIRED|SUSPENDED)|DENIED_NO_SUBSCRIPTION"; then check "Expired sub denied at gate" "ok" "ok"; else warn "Expired sub denial" "$SEED_TAP"; fi

# ----- LISTINGS + REPORTS -----
hdr "LISTINGS + REPORTS"
for path in "/drivers?search=$PLATE" "/vehicles?search=$PLATE" "/subscriptions" "/audit" "/tap-events" "/reports/summary" "/reminders" "/reminders/stats" "/reminders/config" "/plans" "/reports/export/drivers.csv"; do
  rc=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$API$path")
  check "GET $path" "$rc" "200"
done

WACONFIG=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/reminders/config)
if echo "$WACONFIG" | grep -q "\"mode\":\"dry\""; then check "WhatsApp adapter DRY-RUN status" "ok" "ok"; else warn "WhatsApp mode" "live"; fi

AUDIT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/audit?category=AUTH&take=50")
if echo "$AUDIT" | grep -q "welcome_dry_run\|welcome_sent"; then check "Welcome WhatsApp audited" "ok" "ok"; else warn "Welcome audit" "not found"; fi

echo ""
echo "==========================================================="
printf "  Result: %d passed | %d failed | %d warnings\n" "$PASS" "$FAIL" "$WARN"
echo "==========================================================="
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed checks:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0
