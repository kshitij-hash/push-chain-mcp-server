# Contributing to Push Chain MCP Server

Thank you for your interest in contributing to the Push Chain MCP Server! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/push-chain-mcp-server.git`
3. Add upstream remote: `git remote add upstream https://github.com/pushchain/push-chain-mcp-server.git`
4. Install dependencies: `npm install`
5. Set up environment: `cp .env.example .env`
6. Run tests: `npm test`

## How to Contribute

### Types of Contributions

We welcome:

- Bug fixes
- New tool implementations
- Documentation improvements
- Performance optimizations
- Test coverage improvements
- UX/DX improvements

### Development Workflow

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes**: Follow code style guidelines
3. **Test your changes**: Ensure all tests pass
4. **Commit your changes**: Use clear, descriptive commit messages
5. **Push to your fork**: `git push origin feature/your-feature-name`
6. **Create a Pull Request**: Submit PR with detailed description

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- GitHub Personal Access Token (optional but recommended)

### Running the Servers

```bash
# Documentation server
npm start

# SDK server
npm run start:sdk

# Update SDK data
npm run update:sdk

# Force update
npm run update:sdk:force
```

### Testing

```bash
# Run connection tests
npm test

# Test in an IDE (e.g., Claude Code)
# Configure the server in your IDE and test with queries
```

## Code Style Guidelines

### JavaScript/Node.js

- Use ES6+ features and modern JavaScript
- Use `import`/`export` (ES modules)
- Async/await for asynchronous operations
- Descriptive variable and function names
- Add JSDoc comments for complex functions
- Keep functions focused and small

### File Organization

```
mcp-servers/
├── index.js              # Documentation server
├── index-sdk.js          # SDK server
├── schemas/              # Zod validation schemas
├── utils/                # Shared utilities
├── scripts/              # Automation scripts
└── README.md
```

### Error Handling

- Use try/catch blocks for all async operations
- Provide clear, actionable error messages
- Include error context and suggestions for resolution
- Log errors to stderr using `console.error()`

### Tool Development

When adding new tools:

1. **Define input schema** using Zod with proper validation
2. **Write comprehensive descriptions** following MCP best practices:
   - Clear one-line summary
   - Detailed functionality explanation
   - Parameter types with examples
   - Return type schemas
   - Usage examples ("Use when...")
   - Anti-examples ("Don't use when...")
   - Error handling guidance

3. **Implement tool logic**:
   - Use shared utilities to avoid duplication
   - Handle errors gracefully
   - Support multiple response formats (JSON/Markdown)
   - Respect character limits
   - Add pagination for large result sets

4. **Add tool annotations**:
   ```javascript
   annotations: {
     readOnlyHint: true,      // For read-only operations
     destructiveHint: false,  // For non-destructive operations
     idempotentHint: true,    // If repeated calls have same effect
     openWorldHint: true      // If interacting with external systems
   }
   ```

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(sdk): add get_ui_components tool
fix(docs): correct pagination in search results
docs(readme): add troubleshooting section
```

## Submitting Changes

### Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**:
   - Explain what changed and why
   - Reference related issues
   - Include screenshots if UI-related
   - List breaking changes if any

3. **Testing**:
   - Ensure all tests pass
   - Test manually in at least one IDE
   - Add new tests for new features

4. **Documentation**:
   - Update README if needed
   - Add JSDoc comments
   - Update API documentation

### Pull Request Template

```markdown
## Description
[Describe your changes]

## Motivation
[Why is this change needed?]

## Changes
- [ ] Change 1
- [ ] Change 2

## Testing
- [ ] Tested in Claude Code
- [ ] Tested in Cursor
- [ ] All tests pass

## Breaking Changes
[List any breaking changes]

## Related Issues
Closes #[issue number]
```

## Reporting Bugs

### Before Reporting

1. Check existing issues for duplicates
2. Verify you're using the latest version
3. Test with minimal configuration
4. Gather relevant information

### Bug Report Template

```markdown
**Description**
A clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Configure server with...
2. Run query...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [macOS/Linux/Windows]
- Node version: [run `node --version`]
- IDE: [Claude Code/Cursor/Windsurf]
- MCP Server version: [run `npm list push-chain-mcp`]

**Error Output**
```
[Paste error logs]
```

**Additional Context**
Any other relevant information
```

## Suggesting Features

We welcome feature suggestions! Please:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** - why is this feature needed?
3. **Provide examples** - how would it work?
4. **Consider alternatives** - are there other solutions?

### Feature Request Template

```markdown
**Problem Statement**
[What problem does this solve?]

**Proposed Solution**
[Describe your proposed feature]

**Use Cases**
[Example scenarios where this would be useful]

**Alternatives Considered**
[Other approaches you've thought about]

**Additional Context**
[Screenshots, mockups, examples]
```

## Development Tips

### Testing Tools Locally

Since MCP servers run over stdio, testing can be tricky:

```bash
# Option 1: Use in an IDE
# Configure in Claude Code/Cursor/Windsurf and test interactively

# Option 2: Use MCP Inspector (if available)
# Follow MCP documentation for inspector setup

# Option 3: Unit tests
npm test
```

### Debugging

Enable debug logging:

```bash
# Set in .env
DEBUG=push-chain:*
```

### Common Issues

1. **Server not responding**: Check absolute paths in IDE config
2. **Module not found**: Run `npm install`
3. **GitHub rate limit**: Add GITHUB_TOKEN to .env
4. **SDK data outdated**: Run `npm run update:sdk:force`

## Questions?

- Open an issue for questions
- Check existing issues and discussions
- Review README.md and documentation

## Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!
