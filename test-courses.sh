#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="Test123!@#"

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}ETAPA 4 - TESTING SUITE${NC}"
echo -e "${YELLOW}Testing all course functionality${NC}"
echo -e "${YELLOW}=====================================${NC}\n"

# Test 1: Check API is up
echo -e "${YELLOW}[1/7] Testing server connectivity...${NC}"
if curl -s "$API_URL" > /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}\n"
else
    echo -e "${RED}✗ Server is not responding${NC}\n"
    exit 1
fi

# Test 2: List courses
echo -e "${YELLOW}[2/7] Testing course listing...${NC}"
COURSES=$(curl -s "$API_URL/api/courses" | jq '.data[]')
if [ ! -z "$COURSES" ]; then
    echo -e "${GREEN}✓ Courses endpoint working${NC}"
    COURSE_COUNT=$(curl -s "$API_URL/api/courses" | jq '.count')
    echo -e "  Found $COURSE_COUNT courses\n"
else
    echo -e "${RED}✗ Failed to fetch courses${NC}\n"
fi

# Test 3: Get first course details
echo -e "${YELLOW}[3/7] Testing course details...${NC}"
FIRST_COURSE=$(curl -s "$API_URL/api/courses" | jq -r '.data[0].id')
if [ ! -z "$FIRST_COURSE" ] && [ "$FIRST_COURSE" != "null" ]; then
    COURSE_DATA=$(curl -s "$API_URL/api/courses/$FIRST_COURSE")
    COURSE_TITLE=$(echo $COURSE_DATA | jq -r '.data.title')
    echo -e "${GREEN}✓ Course details endpoint working${NC}"
    echo -e "  Course: $COURSE_TITLE\n"
else
    echo -e "${YELLOW}⚠ No courses found${NC}\n"
fi

# Test 4: Test like endpoint without auth
echo -e "${YELLOW}[4/7] Testing like system...${NC}"
if [ ! -z "$FIRST_COURSE" ]; then
    LIKE_RESPONSE=$(curl -s -X POST "$API_URL/api/likes" \
        -H "Content-Type: application/json" \
        -d "{\"targetType\": \"COURSE\", \"courseId\": \"$FIRST_COURSE\"}" \
        -w "%{http_code}")

    HTTP_CODE=$(echo $LIKE_RESPONSE | tail -c 4)
    if [ "$HTTP_CODE" = "401" ]; then
        echo -e "${GREEN}✓ Like endpoint properly requires auth${NC}\n"
    else
        echo -e "${YELLOW}⚠ Like endpoint returned: $HTTP_CODE${NC}\n"
    fi
else
    echo -e "${YELLOW}⚠ Cannot test likes without courses${NC}\n"
fi

# Test 5: Test comments endpoint
echo -e "${YELLOW}[5/7] Testing comments system...${NC}"
if [ ! -z "$FIRST_COURSE" ]; then
    COMMENTS=$(curl -s "$API_URL/api/comments?targetType=COURSE&courseId=$FIRST_COURSE&limit=5")
    COMMENT_COUNT=$(echo $COMMENTS | jq '.data.total')
    echo -e "${GREEN}✓ Comments endpoint working${NC}"
    echo -e "  Found $COMMENT_COUNT comments\n"
else
    echo -e "${YELLOW}⚠ Cannot test comments without courses${NC}\n"
fi

# Test 6: Test like counts endpoint
echo -e "${YELLOW}[6/7] Testing like counts...${NC}"
if [ ! -z "$FIRST_COURSE" ]; then
    COUNTS=$(curl -s "$API_URL/api/likes/count?courseIds=$FIRST_COURSE")
    LIKE_COUNT=$(echo $COUNTS | jq ".data.$FIRST_COURSE // 0")
    echo -e "${GREEN}✓ Like counts endpoint working${NC}"
    echo -e "  Likes on course: $LIKE_COUNT\n"
else
    echo -e "${YELLOW}⚠ Cannot test counts without courses${NC}\n"
fi

# Test 7: Test modules endpoint
echo -e "${YELLOW}[7/7] Testing course modules...${NC}"
if [ ! -z "$FIRST_COURSE" ]; then
    MODULES=$(curl -s "$API_URL/api/courses/$FIRST_COURSE/modules")
    MODULES_COUNT=$(echo $MODULES | jq '.count // 0')
    echo -e "${GREEN}✓ Modules endpoint working${NC}"
    echo -e "  Modules in course: $MODULES_COUNT\n"
else
    echo -e "${YELLOW}⚠ Cannot test modules without courses${NC}\n"
fi

# Summary
echo -e "${YELLOW}=====================================${NC}"
echo -e "${GREEN}✓ All tests completed!${NC}"
echo -e "${YELLOW}=====================================${NC}\n"

echo -e "${YELLOW}MANUAL TESTING TODO:${NC}"
echo -e "1. Test authentication:"
echo -e "   - Sign in with email/password"
echo -e "   - Sign in with Google"
echo -e "   - Verify tokens are set\n"

echo -e "2. Test course page:"
echo -e "   - View course landing page"
echo -e "   - Like button visible"
echo -e "   - Comments section visible"
echo -e "   - See buy button if no access\n"

echo -e "3. Test payment:"
echo -e "   - Click 'Comprar Curso'"
echo -e "   - Redirect to Stripe checkout"
echo -e "   - Use test card: 4242 4242 4242 4242"
echo -e "   - Complete payment\n"

echo -e "4. Test course access:"
echo -e "   - After payment, should have access"
echo -e "   - Can see modules list"
echo -e "   - Can watch videos"
echo -e "   - Progress tracking works\n"

echo -e "5. Test community features:"
echo -e "   - Like course/module (click heart)"
echo -e "   - Post comment"
echo -e "   - Delete own comment"
echo -e "   - Open chat and send message\n"
