# Push Chain MCP Server Setup Guide

Complete setup guide for using the Push Chain MCP server with Claude Code, Cursor, or Windsurf.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [IDE Configuration](#ide-configuration)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
- [Verification](#verification)
- [Getting Started](#getting-started)
- [Example Queries](#example-queries)
- [Advanced Testing](#advanced-testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- **GitHub Personal Access Token** (optional but recommended for higher API rate limits)
  - Generate at: https://github.com/settings/tokens
  - No special permissions needed - public repo access only
  - Provides 5000 requests/hour vs 60/hour without token

---

## Installation

### Automated Setup (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/kshitij-hash/push-chain-mcp-server.git
cd push-chain-mcp-server

# 2. Run the setup script
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Check Node.js version
- ✅ Install dependencies
- ✅ Create `.env` file
- ✅ Show IDE configuration instructions

### Manual Setup

```bash
# 1. Clone and navigate
git clone https://github.com/kshitij-hash/push-chain-mcp-server.git
cd push-chain-mcp-server

# 2. Install dependencies
npm install

# 3. (Optional) Configure GitHub token
cp .env.example .env
# Edit .env and add your GITHUB_TOKEN

# 4. Verify installation
npm start
```

### GitHub Token Configuration (Optional)

For higher API rate limits and auto-updates:

1. Create a `.env` file in the `mcp-servers/` directory:
   ```bash
   GITHUB_TOKEN=your_github_personal_access_token
   SDK_AUTO_UPDATE=true
   SDK_UPDATE_INTERVAL=conservative
   ```

2. Generate a token at: https://github.com/settings/tokens
   - Select "Generate new token (classic)"
   - No special permissions needed (public repo access only)
   - Copy the token and paste it in your `.env` file

---

## IDE Configuration

Choose your IDE below for detailed setup instructions.

### Claude Code

**Quick Setup (Recommended):**

```bash
# Get absolute path
cd push-chain-mcp-server
pwd  # Copy this path

# Add server using CLI
claude mcp add --transport stdio push-chain -- node /absolute/path/to/index-unified.js
```

**Project Configuration:** Create `.mcp.json` in your project root for team sharing:

```json
{
  "mcpServers": {
    "push-chain": {
      "command": "node",
      "args": ["/absolute/path/to/index-unified.js"],
      "env": {"GITHUB_TOKEN": "${GITHUB_TOKEN}"}
    }
  }
}
```

**Manual Configuration:** Edit config file at:
- **macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Use the same JSON structure as above.

#### Restart Claude Code

After configuration, restart Claude Code:

- **macOS**: Press `Cmd+Q` to quit, then reopen Claude Code
- **Windows**: Right-click Claude in system tray → Quit, then restart
- **Linux**: Quit the application and restart

#### Verify Installation

In Claude Code, type `/mcp` to check MCP server status, or ask:
```
List all Push Chain documentation
```

You should see a list of available documentation files.

---

### Cursor

**Project Configuration (Recommended):** Create `.cursor/mcp.json` in your project root:

```bash
mkdir -p .cursor
cat > .cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "push-chain": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/index-unified.js"],
      "env": {"GITHUB_TOKEN": "${env:GITHUB_TOKEN}"}
    }
  }
}
EOF
```

**Global Configuration:** Use `~/.cursor/mcp.json` for all projects.

**Variable Support:** Cursor supports `${env:VAR}`, `${userHome}`, `${workspaceFolder}`, and `${workspaceFolderBasename}`.

#### Restart Cursor

Close and reopen Cursor completely for changes to take effect.

#### Verify

In the Cursor chat, ask:
```
Show me the PushClient class
```

You should see detailed information about the PushClient class.

---

### Windsurf

**Configuration:** Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "push-chain": {
      "command": "node",
      "args": ["/absolute/path/to/index-unified.js"],
      "env": {"GITHUB_TOKEN": "your_github_token_here"}
    }
  }
}
```

**Refresh:** After editing, open Windsurf → Cascade panel → Plugins icon → Refresh button.

**Note:** Windsurf has a 100-tool maximum across all plugins.

#### Restart Windsurf

Close and reopen Windsurf completely for changes to take effect.

#### Verify

In Cascade, ask:
```
What packages are available in Push Chain?
```

You should see information about `@pushchain/core` and `@pushchain/ui-kit`.

---

## Verification

After setup, verify the MCP server is working:

### Quick Test

Ask your AI assistant:
```
List all Push Chain documentation
```

**Expected Response**: A list of available documentation files organized by category.

### Full Test

Run these three queries:

1. **Documentation Test**:
   ```
   Show me the Push Chain introduction guide
   ```

2. **SDK Test**:
   ```
   What methods does PushClient have?
   ```

3. **Search Test**:
   ```
   Search for wallet-related documentation and APIs
   ```

If all three work, your setup is complete!

---

## Getting Started

Now that your MCP server is configured, here's how to use it effectively.

### Understanding Available Tools

The Push Chain MCP server provides **13 powerful tools**:

#### Documentation Tools (4 tools)
- `list_push_chain_docs` - Browse all documentation
- `get_push_chain_doc` - Read specific documentation files
- `search_push_chain_docs` - Search documentation by keywords
- `get_code_snippets` - Extract code examples from docs

#### SDK Tools (9 tools)
- `get_sdk_api` - Get API details for functions/classes
- `search_sdk` - Search across all SDK code
- `get_package_info` - View package metadata
- `get_type_definition` - Get TypeScript types
- `get_source_file` - Read source code
- `list_all_exports` - List all exported APIs
- `find_usage_examples` - Find real usage examples
- `get_core_classes` - Get all core classes
- `get_ui_components` - Get all React components

**You don't need to call these tools directly** - just ask natural language questions and your AI assistant will use them automatically!

---

## Example Queries

**Documentation:**
- "List all available Push Chain documentation"
- "Show me the Push Chain introduction guide"
- "Search for wallet documentation"

**SDK:**
- "What methods does PushClient have?"
- "Show me the UniversalAccount type definition"
- "List all React hooks in ui-kit"

**Complex:**
- "I want to build a wallet - show me relevant docs and SDK APIs"
- "How do I implement transaction signing? Show types, functions, and examples"

**For 50+ comprehensive test queries, see [TEST-QUERIES.md](./TEST-QUERIES.md)**

---

## Advanced Testing

For comprehensive testing with 50+ queries covering all features, edge cases, and real-world scenarios, see [TEST-QUERIES.md](./TEST-QUERIES.md).

---

## Troubleshooting

### Server Not Responding
1. Verify absolute path in config: `cd mcp-servers && pwd`
2. Check Node.js version: `node --version` (need v18+)
3. Test manually: `npm start` (should start without errors)
4. Restart IDE completely

### Module Not Found
```bash
cd mcp-servers
rm -rf node_modules package-lock.json
npm install
```

### GitHub Rate Limiting
Add GitHub token to `.env` file or wait ~1 hour for reset.

### Outdated SDK Data
```bash
npm run update:sdk:force
```

### Data Files Missing
```bash
npm run update:docs
npm run update:sdk:force
```

---

## Getting Help

If issues persist:
- Check [README.md](./README.md) and [TEST-QUERIES.md](./TEST-QUERIES.md)
- Open an issue at [GitHub Issues](https://github.com/kshitij-hash/push-chain-mcp-server/issues)

Include: OS, Node.js version, IDE, error messages, and config (remove tokens).

---

**Happy building with Push Chain!**
