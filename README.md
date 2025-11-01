# Push Chain MCP Server

Unified Model Context Protocol (MCP) server providing AI assistants with comprehensive access to Push Chain documentation and SDK (`@pushchain/core`, `@pushchain/ui-kit`).


## What is This?

This unified MCP server enables AI assistants (like Claude) to access and query both Push Chain's documentation and SDK in a single, streamlined interface. It combines:

1. **Documentation Access**: Browse, search, and retrieve Push Chain documentation from GitHub
2. **SDK Analysis**: Query functions, classes, types, and code examples from `@pushchain/core` and `@pushchain/ui-kit`

With this server, your AI assistant can help you:
- Find relevant documentation instantly
- Understand SDK APIs and their usage
- Get TypeScript type definitions
- Discover code examples and best practices
- Access both docs and SDK through one unified interface

## Table of Contents

- [What is This?](#what-is-this)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Setup](#setup)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
- [Available Tools](#available-tools)
- [Example Queries](#example-queries)
- [SDK Auto-Update](#sdk-auto-update)
- [GitHub Token Configuration](#github-token-recommended)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Development](#development)

## Features

- **Unified Interface**: Single server combining both documentation and SDK access
- **Documentation Access**: Browse and search all Push Chain `.mdx` documentation from GitHub
- **SDK Analysis**: Query functions, classes, types, and interfaces from `@pushchain/core` and `@pushchain/ui-kit`
- **Code Examples**: Find real usage examples and implementation patterns from both docs and SDK
- **Type Definitions**: Get complete TypeScript type information
- **Auto-Update**: Automatically keeps SDK data fresh from GitHub
- **13 Powerful Tools**: 4 documentation tools + 9 SDK tools in one server

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **GitHub Personal Access Token** (optional but recommended for higher API rate limits)
  - Generate at: https://github.com/settings/tokens
  - No special permissions needed - public repo access only

## Quick Start

### Automated Setup (Recommended)

```bash
# 1. Clone and navigate
git clone https://github.com/pushchain/push-chain-mcp-server.git
cd push-chain-mcp-server/mcp-servers

# 2. Run setup script
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
git clone https://github.com/pushchain/push-chain-mcp-server.git
cd push-chain-mcp-server/mcp-servers

# 2. Install dependencies
npm install

# 3. (Optional) Configure GitHub token
cp .env.example .env
# Edit .env and add your GITHUB_TOKEN

# 4. Start
npm start
```

## Setup

### Claude Code

1. **Find your config file location:**
   - macOS/Linux: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Get the absolute path to this project:**
   ```bash
   cd mcp-servers
   pwd  # Copy this path
   ```

3. **Edit your Claude config file** and add:
   ```json
   {
     "mcpServers": {
       "push-chain": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/index-unified.js"]
       }
     }
   }
   ```
   Replace `/absolute/path/to/mcp-servers/` with your actual path from step 2.

4. **Restart Claude Code:**
   - macOS: `Cmd+Q` then reopen
   - Windows: Close from system tray, then restart

5. **Verify:**
   Ask Claude: "List all Push Chain documentation" or "Show me the PushClient class"

**Note**: The unified server provides access to both documentation and SDK through a single connection!

### Cursor

1. **Get the absolute path:**
   ```bash
   cd mcp-servers
   pwd
   ```

2. **Open Cursor Settings:**
   - `Cmd/Ctrl + Shift + P` → "Preferences: Open User Settings (JSON)"

3. **Add MCP configuration:**
   ```json
   {
     "mcp.servers": {
       "push-chain": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/index-unified.js"]
       }
     }
   }
   ```

4. **Restart Cursor**

5. **Verify:**
   In chat, ask: "Search Push Chain docs for wallet setup" or "Show me PushClient methods"

### Windsurf

1. **Get the absolute path:**
   ```bash
   cd mcp-servers
   pwd
   ```

2. **Open Windsurf Settings:**
   - Click Settings icon → "MCP Servers"

3. **Add new server:**
   - Name: `push-chain`
   - Command: `node`
   - Args: `/absolute/path/to/mcp-servers/index-unified.js`

4. **Enable the server** (toggle switch to ON)

5. **Restart Windsurf**

6. **Verify:**
   In Cascade, ask: "List Push Chain docs" or "Get all exports from @pushchain/core"

## Available Tools

The unified server provides **13 powerful tools** organized into two categories:

### Documentation Tools (4 tools)

| Tool | Description |
|------|-------------|
| `list_push_chain_docs` | List all documentation files with category filtering |
| `get_push_chain_doc` | Get full content of a specific doc file |
| `search_push_chain_docs` | Search docs by keywords or topics |
| `get_code_snippets` | Extract code examples from documentation |

### SDK Tools (9 tools)

| Tool | Description |
|------|-------------|
| `get_sdk_api` | Get API details for functions, classes, types |
| `search_sdk` | Search across all SDK code and types |
| `get_package_info` | Get package metadata and statistics |
| `get_type_definition` | Get TypeScript type definitions |
| `get_source_file` | Read complete source code of any file |
| `list_all_exports` | List all exported APIs by type |
| `find_usage_examples` | Find real usage examples in codebase |
| `get_core_classes` | Get all classes from @pushchain/core |
| `get_ui_components` | Get React components and hooks from ui-kit |

**All tools are accessible through a single server connection!**

## Example Queries

Once configured in your IDE, try asking your AI assistant these questions:

### Documentation Queries

```
"List all Push Chain tutorials"
"Show me the wallet setup guide"
"Search documentation for transaction examples"
"Get the intro to Push Chain documentation"
"Find all UI Kit documentation"
"What code examples are in the wallet docs?"
```

### SDK Queries

```
"What methods does PushClient have?"
"Show me the UniversalAccount type definition"
"Find usage examples of createUniversalSigner"
"List all React hooks in ui-kit"
"Get the PushClient class details"
"What functions are exported from @pushchain/core?"
"Search for wallet-related APIs"
"Show me all UI components in ui-kit"
```

### Combined Queries (Most Powerful!)

```
"How do I create a transaction using PushClient? Show me the type definitions and code examples from the docs"
"What's the difference between UniversalSigner and UniversalAccount? Include examples"
"I want to build a wallet - show me relevant docs and the SDK APIs I'll need"
"Find all authentication-related documentation and SDK functions"
```

## SDK Auto-Update

The SDK server automatically checks for updates from the Push Chain repository and refreshes data when changes are detected.

### How It Works

1. **Smart Change Detection**: Checks GitHub commit SHA before updating
2. **Package-Specific Tracking**: Only updates when `@pushchain/core` or `@pushchain/ui-kit` change
3. **Configurable Intervals**: Default 24-hour check interval (customizable)
4. **Non-Blocking**: Updates happen in background, server remains responsive

### Configuration

Add to your `.env` file:

```bash
# GitHub token (recommended for higher rate limits)
GITHUB_TOKEN=your_github_personal_access_token

# Update check interval (optional)
# Options: aggressive (1h), moderate (6h), conservative (24h - default), weekly (7d)
SDK_UPDATE_INTERVAL=conservative

# Disable auto-updates (optional)
SDK_AUTO_UPDATE=false
```

### Manual Update Commands

```bash
# Check for updates (respects interval)
npm run update:sdk

# Force update immediately
npm run update:sdk:force

# Regenerate SDK data from existing clone
npm run analyze:sdk
```

### Update Intervals

| Interval | Check Frequency | Best For |
|----------|----------------|----------|
| `aggressive` | Every hour | Active development |
| `moderate` | Every 6 hours | Testing environments |
| `conservative` | Every 24 hours | Production (default) |
| `weekly` | Every 7 days | Stable deployments |

## GitHub Token (Recommended)

For higher API rate limits (5000/hour vs 60/hour) and auto-updates:

1. Create `.env` file in `mcp-servers/`:
   ```bash
   GITHUB_TOKEN=your_github_personal_access_token
   SDK_UPDATE_INTERVAL=conservative
   ```

2. Generate token at: https://github.com/settings/tokens
   - No special permissions needed (public repo access only)

## Troubleshooting

### Server not responding

1. Check absolute paths are correct in your config
2. Ensure Node.js is in your PATH: `node --version`
3. Verify installation: `cd mcp-servers && npm install`

### "Module not found" errors

```bash
cd mcp-servers
rm -rf node_modules package-lock.json
npm install
```

### Rate limiting

If you see "GitHub API rate limit exceeded":
- Add a GitHub token (see SDK Auto-Update section)
- Wait ~1 hour for rate limit reset
- Temporarily disable auto-updates: `SDK_AUTO_UPDATE=false`

### SDK data outdated

If the AI provides outdated SDK information:

```bash
# Force update SDK data
npm run update:sdk:force

# Check when last updated
cat .sdk-update-metadata.json
```

### Config file location issues

**Claude Code:**
- Create config directory if missing: `mkdir -p ~/Library/Application\ Support/Claude`
- Create empty config: `echo '{"mcpServers":{}}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json`

**Cursor/Windsurf:**
- Check IDE-specific documentation for MCP server configuration location

## Project Structure

```
mcp-servers/
├── setup.sh                   # 🚀 Quick setup script
├── index-unified.js           # ⭐ Main unified server
├── sdk-updater.js             # Auto-update system
├── generate-sdk-data.js       # SDK data generator
├── generate-docs-data.js      # Documentation data generator
├── package.json               # Dependencies
├── .mcp.json                  # MCP server configuration
│
├── data/                      # Data files
│   ├── docs_cache.json        # Cached documentation
│   ├── sdk_complete_analysis.json
│   ├── sdk_complete_exports.json
│   ├── sdk_file_contents.json
│   └── sdk_packages_complete.json
│
├── schemas/                   # Input validation
│   ├── docs-schemas.js
│   └── sdk-schemas.js
│
├── scripts/                   # Utility & test scripts
│   ├── analyze-sdk.js         # SDK analyzer
│   ├── test-unified-server.js # Comprehensive tests
│   ├── test-mcp-compliance.js # MCP compliance tests
│   ├── test-docs-loading.js   # Documentation tests
│   ├── test-connection.js     # Connection tests
│   └── stress-test.js         # Performance tests
│
└── utils/                     # Shared utilities
    ├── constants.js
    ├── error-handler.js
    ├── response-formatter.js
    └── schema-converter.js
```

## Development

**Run server:**
```bash
npm start                # Start the unified server
```

**Update data:**
```bash
# SDK data updates
npm run update:sdk        # Check for updates
npm run update:sdk:force  # Force immediate update
npm run analyze:sdk       # Analyze local SDK clone

# Documentation updates
npm run update:docs       # Fetch latest documentation from GitHub
```

**Environment variables:**
```bash
# .env file
GITHUB_TOKEN=ghp_xxxxx              # GitHub PAT (recommended)
SDK_UPDATE_INTERVAL=conservative    # Update frequency
SDK_AUTO_UPDATE=true                # Enable auto-updates
```

**Architecture:**
- `index-unified.js` - Main unified server (all features)
- Uses stdio transport for MCP communication

## Support

- **Documentation**: See this README
- **Issues**: [GitHub Issues](https://github.com/pushchain/push-chain-mcp-server/issues)

## Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Powered by [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- Designed for use with Claude, Cursor, Windsurf, and other MCP-compatible AI assistants

---

**Made with ❤️ for Push Chain developers**
