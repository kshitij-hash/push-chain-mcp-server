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
- [Quick Start](#quick-start)
- [Setup](#setup)
- [Available Tools](#available-tools)
- [Example Queries](#example-queries)
- [SDK Auto-Update](#sdk-auto-update)
- [Project Structure](#project-structure)
- [Development](#development)
- [Support](#support)

## Features

- **Unified Interface**: Single server combining both documentation and SDK access
- **Documentation Access**: Browse and search all Push Chain `.mdx` documentation from GitHub
- **SDK Analysis**: Query functions, classes, types, and interfaces from `@pushchain/core` and `@pushchain/ui-kit`
- **Code Examples**: Find real usage examples and implementation patterns from both docs and SDK
- **Type Definitions**: Get complete TypeScript type information
- **Auto-Update**: Automatically keeps SDK data fresh from GitHub
- **13 Powerful Tools**: 4 documentation tools + 9 SDK tools in one server

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/kshitij-hash/push-chain-mcp-server.git
cd push-chain-mcp-server

# 2. Run the setup script
chmod +x setup.sh
./setup.sh

# 3. Follow the IDE-specific instructions in SETUP.md
```

## Setup

**For detailed setup instructions for your IDE, see [SETUP.md](./SETUP.md)**

The setup guide includes:
- ✅ Prerequisites and installation steps
- ✅ IDE-specific configuration for Claude Code, Cursor, and Windsurf
- ✅ GitHub token configuration (optional)
- ✅ Verification steps
- ✅ Example queries to get started
- ✅ Comprehensive troubleshooting guide

**Quick Links:**
- [Claude Code Setup](./SETUP.md#claude-code)
- [Cursor Setup](./SETUP.md#cursor)
- [Windsurf Setup](./SETUP.md#windsurf)
- [Example Queries](./SETUP.md#example-queries)
- [Troubleshooting](./SETUP.md#troubleshooting)

## Available Tools

The unified server provides **13 powerful tools**:
- **4 Documentation tools**: List, search, read docs, and extract code snippets
- **9 SDK tools**: Query APIs, search code, get types, find examples, and more

**All tools are accessible through a single server connection!** See [SETUP.md](./SETUP.md#understanding-available-tools) for complete tool descriptions.

## Example Queries

Once configured, try these queries to get started:

**Documentation:**
```
"List all Push Chain tutorials"
"Show me the wallet setup guide"
"Search documentation for transaction examples"
```

**SDK:**
```
"What methods does PushClient have?"
"Show me the UniversalAccount type definition"
"List all React hooks in ui-kit"
```

**Combined:**
```
"I want to build a wallet - show me relevant docs and SDK APIs"
"How do I implement transaction signing? Show types, functions, and examples"
```

**For 50+ comprehensive test queries, see [TEST-QUERIES.md](./TEST-QUERIES.md)**

**For detailed example queries and getting started guide, see [SETUP.md](./SETUP.md#example-queries)**

## Development

```bash
# Start server
npm start

# Update data
npm run update:sdk        # Check for SDK updates
npm run update:docs       # Fetch latest documentation
```

**Configuration:** Create a `.env` file for GitHub token and auto-update settings. See [SETUP.md](./SETUP.md#github-token-configuration-optional) for details.

## Support

- **Setup Guide**: [SETUP.md](./SETUP.md) - Detailed setup instructions for all IDEs
- **Test Queries**: [TEST-QUERIES.md](./TEST-QUERIES.md) - 50+ comprehensive test queries
- **Documentation**: See this README for project overview
- **Issues**: [GitHub Issues](https://github.com/kshitij-hash/push-chain-mcp-server/issues)

## Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Powered by [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- Designed for use with Claude, Cursor, Windsurf, and other MCP-compatible AI assistants

---

**Made with ❤️ for Push Chain developers**
