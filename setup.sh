#!/bin/bash

# Push Chain MCP Server - Quick Setup Script
# This script helps you get started quickly with the MCP server

set -e

GREEN='\033[0.32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Push Chain MCP Server - Quick Setup     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}\n"

# Check Node.js version
echo -e "${BLUE}[1/5]${NC} Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo -e "${YELLOW}Please install Node.js 18+ from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version must be 18 or higher${NC}"
    echo -e "${YELLOW}Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}\n"

# Install dependencies
echo -e "${BLUE}[2/5]${NC} Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Setup environment file
echo -e "${BLUE}[3/5]${NC} Setting up environment..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file from template${NC}"
        echo -e "${YELLOW}→ Edit .env to add your GitHub token (optional)${NC}"
    else
        cat > .env << EOF
# Push Chain MCP Server Configuration

# GitHub Token (optional but recommended)
# Generate at: https://github.com/settings/tokens
GITHUB_TOKEN=

# SDK Auto-Update (set to false if no GitHub token)
SDK_AUTO_UPDATE=false
SDK_UPDATE_INTERVAL=conservative
EOF
        echo -e "${GREEN}✓ Created .env file${NC}"
        echo -e "${YELLOW}→ GitHub token not required for local use${NC}"
    fi
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

# Check SDK data files
echo -e "${BLUE}[4/5]${NC} Checking SDK data files..."
if [ -f "data/sdk_file_contents.json" ] && [ -f "data/sdk_complete_exports.json" ]; then
    echo -e "${GREEN}✓ SDK data files present${NC}"
else
    echo -e "${YELLOW}⚠ SDK data files missing${NC}"
    echo -e "${YELLOW}→ This is normal for first-time setup${NC}"
fi
echo ""

# Run tests
echo -e "${BLUE}[5/5]${NC} Running tests..."
if npm test 2>&1 | grep -q "ALL TESTS PASSED"; then
    echo -e "${GREEN}✓ All tests passed!${NC}\n"
else
    echo -e "${YELLOW}⚠ Some tests may have failed (check output above)${NC}\n"
fi

# Success message with instructions
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup Complete! 🎉               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Next steps:${NC}\n"

echo -e "1️⃣  ${YELLOW}Start the server:${NC}"
echo -e "   npm start\n"

echo -e "2️⃣  ${YELLOW}Configure your IDE:${NC}"
echo -e "   ${GREEN}Claude Desktop:${NC}"
echo -e "   Add to ~/Library/Application Support/Claude/claude_desktop_config.json:\n"
echo -e '   {
     "mcpServers": {
       "push-chain": {
         "command": "node",
         "args": ["'$(pwd)'/index-unified.js"]
       }
     }
   }'
echo ""

echo -e "   ${GREEN}Cursor:${NC}"
echo -e "   Add to settings JSON (Cmd+Shift+P → 'Open User Settings'):\n"
echo -e '   {
     "mcp.servers": {
       "push-chain": {
         "command": "node",
         "args": ["'$(pwd)'/index-unified.js"]
       }
     }
   }'
echo ""

echo -e "3️⃣  ${YELLOW}Test it:${NC}"
echo -e "   Ask your AI: ${GREEN}\"List all Push Chain documentation\"${NC}\n"

echo -e "${BLUE}Optional:${NC}"
echo -e "• Add GitHub token to .env for auto-updates"
echo -e "• Run ${GREEN}npm run test:stress${NC} for performance tests"
echo -e "• See ${GREEN}docs/DEPLOYMENT.md${NC} for public URL deployment\n"

echo -e "${BLUE}Need help?${NC}"
echo -e "• README: ./README.md"
echo -e "• Issues: https://github.com/pushchain/push-chain-mcp-server/issues\n"

echo -e "${GREEN}Happy coding with Push Chain! 🚀${NC}\n"
