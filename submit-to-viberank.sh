#!/bin/bash

# Submit ccusage data to Viberank
# Usage: ./submit-to-viberank.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Viberank Submission Tool${NC}"
echo ""

# Check if ccusage is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Get GitHub username from git config
GITHUB_USER=$(git config user.name 2>/dev/null || echo "")

if [ -z "$GITHUB_USER" ]; then
    echo -e "${YELLOW}Warning: Could not get GitHub username from git config${NC}"
    echo -n "Please enter your GitHub username: "
    read GITHUB_USER
fi

echo -e "GitHub username: ${GREEN}$GITHUB_USER${NC}"
echo ""

# Generate ccusage data
echo -e "${YELLOW}Generating usage data...${NC}"
npx ccusage@latest --json > cc.json

if [ ! -f "cc.json" ]; then
    echo -e "${RED}Error: Failed to generate cc.json${NC}"
    exit 1
fi

# Display summary
echo -e "${GREEN}✓ Generated cc.json successfully${NC}"
echo ""
echo "Summary:"
jq -r '.totals | "  Total Cost: $\(.totalCost | round)\n  Total Tokens: \(.totalTokens)\n  Days Tracked: \(.daily | length)"' cc.json 2>/dev/null || echo "  (install jq for summary)"
echo ""

# Submit to Viberank
echo -e "${YELLOW}Submitting to Viberank...${NC}"

RESPONSE=$(curl -s -X POST https://www.viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: $GITHUB_USER" \
  -d @cc.json)

# Check if submission was successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    PROFILE_URL=$(echo "$RESPONSE" | grep -o '"profileUrl":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Successfully submitted to Viberank!${NC}"
    echo ""
    echo -e "View your profile at: ${GREEN}$PROFILE_URL${NC}"
else
    echo -e "${RED}Error: Failed to submit to Viberank${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

# Cleanup
echo ""
echo -n "Remove cc.json file? (y/N): "
read -n 1 REMOVE
echo ""
if [[ $REMOVE =~ ^[Yy]$ ]]; then
    rm cc.json
    echo -e "${GREEN}✓ Cleaned up cc.json${NC}"
fi

echo ""
echo -e "${GREEN}Done!${NC}"