#!/bin/bash

# ETAPA 5 Testing Script
# Tests all new endpoints and features

BASE_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "ETAPA 5 - Comprehensive Testing"
echo "================================================"
echo ""

test_count=0
pass_count=0
fail_count=0

test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expected_status=$4
  local description=$5

  test_count=$((test_count + 1))
  echo -n "Test $test_count: $description... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  status=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  if [[ "$status" == "$expected_status"* ]]; then
    echo -e "${GREEN}PASS${NC} (Status: $status)"
    pass_count=$((pass_count + 1))
  else
    echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $status)"
    echo "  Response: $body"
    fail_count=$((fail_count + 1))
  fi
}

# Test public endpoints (no auth required)
echo -e "${YELLOW}=== Testing Public Endpoints (No Auth Required) ===${NC}"
echo ""

# Test public user profile (should return 200 or 404 if not found)
test_endpoint "GET" "/api/users/nonexistent/profile" "" "404" "Public profile - non-existent user"

# Test public user activity (should return 404 if user not found)
test_endpoint "GET" "/api/users/nonexistent/activity" "" "404" "Public activity - non-existent user"

echo ""
echo -e "${YELLOW}=== Testing Protected Endpoints (Auth Required) ===${NC}"
echo ""

# Test notifications without auth
test_endpoint "GET" "/api/notifications" "" "401" "Get notifications - no auth"

# Test my stats without auth
test_endpoint "GET" "/api/me/stats" "" "401" "Get stats - no auth"

# Test my activity without auth
test_endpoint "GET" "/api/me/activity" "" "401" "Get activity - no auth"

echo ""
echo -e "${YELLOW}=== Testing Admin Endpoints (Admin Role Required) ===${NC}"
echo ""

# Test admin courses without auth
test_endpoint "GET" "/api/admin/courses" "" "401" "Admin courses list - no auth"

# Test create course without auth
test_endpoint "POST" "/api/admin/courses" '{"title":"Test Course","priceCents":9999}' "401" "Create course - no auth"

echo ""
echo "================================================"
echo -e "Test Results: ${GREEN}$pass_count passed${NC}, ${RED}$fail_count failed${NC} out of $test_count total"
echo "================================================"

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
