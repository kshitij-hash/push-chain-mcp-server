# Push Chain MCP Server

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

Model Context Protocol (MCP) server providing AI assistants with access to Push Chain documentation and SDK (`@pushchain/core`, `@pushchain/ui-kit`).

## What is This?

This MCP server enables AI assistants (like Claude) to access and query Push Chain's documentation and SDK directly. It provides two main capabilities:

1. **Documentation Server**: Browse, search, and retrieve Push Chain documentation from GitHub
2. **SDK Server**: Query functions, classes, types, and code examples from `@pushchain/core` and `@pushchain/ui-kit`

With this server, your AI assistant can help you:
- Find relevant documentation instantly
- Understand SDK APIs and their usage
- Get TypeScript type definitions
- Discover code examples and best practices

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
- [Contributing](#contributing)

## Features

- **Documentation Access**: Browse and search all Push Chain `.mdx` documentation from GitHub
- **SDK Analysis**: Query functions, classes, types, and interfaces from `@pushchain/core` and `@pushchain/ui-kit`
- **Code Examples**: Find real usage examples and implementation patterns
- **Type Definitions**: Get complete TypeScript type information

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **GitHub Personal Access Token** (optional but recommended for higher API rate limits)
  - Generate at: https://github.com/settings/tokens
  - No special permissions needed - public repo access only

## Quick Start

Get up and running in 3 steps:

```bash
# 1. Clone and install
git clone https://github.com/pushchain/push-chain-mcp-server.git
cd push-chain-mcp-server

# 2. Install dependencies
npm install

# 3. (Optional) Configure GitHub token for higher rate limits
cp .env.example .env
# Edit .env and add your GITHUB_TOKEN

# 4. Verify installation
npm test
```

If all tests pass ✅, you're ready to configure in your IDE!

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
       "push-chain-docs": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/index.js"]
       },
       "push-chain-sdk": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/index-sdk.js"]
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
       "push-chain-docs": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/index.js"]
       },
       "push-chain-sdk": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/index-sdk.js"]
       }
     }
   }
   ```

4. **Restart Cursor**

5. **Verify:**
   In chat, ask: "Search Push Chain docs for wallet setup"

### Windsurf

1. **Get the absolute path:**
   ```bash
   cd mcp-servers
   pwd
   ```

2. **Open Windsurf Settings:**
   - Click Settings icon → "MCP Servers"

3. **Add new servers:**

   **Server 1:**
   - Name: `push-chain-docs`
   - Command: `node`
   - Args: `/absolute/path/to/mcp-servers/index.js`

   **Server 2:**
   - Name: `push-chain-sdk`
   - Command: `node`
   - Args: `/absolute/path/to/mcp-servers/index-sdk.js`

4. **Enable the servers** (toggle switch to ON)

5. **Restart Windsurf**

6. **Verify:**
   In Cascade, ask: "Get all exports from @pushchain/core"

## Available Tools

### Documentation Server (4 tools)

| Tool | Description |
|------|-------------|
| `list_push_chain_docs` | List all documentation files with category filtering |
| `get_push_chain_doc` | Get full content of a specific doc file |
| `search_push_chain_docs` | Search docs by keywords or topics |
| `get_code_snippets` | Extract code examples from documentation |

### SDK Server (9 tools)

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
├── index.js                   # Documentation server
├── index-sdk.js               # SDK server (with auto-update)
├── sdk-updater.js             # Auto-update system
├── package.json               # Dependencies
├── schemas/                   # Input validation
│   ├── docs-schemas.js
│   └── sdk-schemas.js
├── scripts/                   # Utility scripts
│   └── analyze-sdk.js         # SDK analyzer
├── utils/                     # Shared utilities
│   ├── constants.js
│   ├── response-formatter.js
│   └── error-handler.js
├── sdk_*.json                 # SDK data (auto-updated)
└── .sdk-update-metadata.json  # Update tracking (gitignored)
```

## Development

**Run servers:**
```bash
npm start          # Documentation server
npm run start:sdk  # SDK server
```

**Update SDK data:**
```bash
npm run update:sdk        # Check for updates
npm run update:sdk:force  # Force immediate update
npm run analyze:sdk       # Analyze local SDK clone
```

**Environment variables:**
```bash
# .env file
GITHUB_TOKEN=ghp_xxxxx              # GitHub PAT (recommended)
SDK_UPDATE_INTERVAL=conservative    # Update frequency
SDK_AUTO_UPDATE=true                # Enable auto-updates
```

Servers use stdio transport - test via MCP client or configured IDE.

## Contributing

We welcome contributions!

### Ways to Contribute

- Report bugs and request features via [GitHub Issues](https://github.com/pushchain/push-chain-mcp-server/issues)
- Submit pull requests for bug fixes or new features
- Improve documentation
- Share feedback and usage examples

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Support

- **Documentation**: See this README and [CONTRIBUTING.md](CONTRIBUTING.md)
- **Issues**: [GitHub Issues](https://github.com/pushchain/push-chain-mcp-server/issues)

## Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Powered by [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- Designed for use with Claude, Cursor, Windsurf, and other MCP-compatible AI assistants

---

**Made with ❤️ for Push Chain developers**
