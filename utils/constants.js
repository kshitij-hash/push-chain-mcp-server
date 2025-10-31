/**
 * Constants for Push Chain MCP Servers
 */

/**
 * Maximum character limit for responses to prevent overwhelming LLM context
 * Set to 25,000 characters as per MCP best practices
 */
export const CHARACTER_LIMIT = 25000;

/**
 * Cache TTL for GitHub API responses (in milliseconds)
 * 30 minutes to minimize API rate limiting
 */
export const CACHE_TTL = 1000 * 60 * 30;

/**
 * GitHub API configuration
 */
export const GITHUB_CONFIG = {
  owner: "pushchain",
  repo: "push-chain-website",
  branch: "1059-documentation-push-wallet",
  basePath: "docs/chain",
  apiBase: "https://api.github.com",
  rawBase: "https://raw.githubusercontent.com"
};
