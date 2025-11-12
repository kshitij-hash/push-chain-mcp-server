/**
 * Zod validation schemas for Push Chain Documentation MCP Server
 *
 * These schemas provide runtime validation for all tool inputs,
 * ensuring type safety and meaningful error messages.
 */

import { z } from "zod";

/**
 * Response format enum for consistent output formatting
 */
export const ResponseFormat = {
  MARKDOWN: "markdown",
  JSON: "json"
};

/**
 * Schema for list_push_chain_docs tool
 * Lists all available Push Chain documentation files with optional category filtering
 */
export const ListDocsInputSchema = z.object({
  category: z.enum(["tutorials", "setup", "build", "ui-kit", "deep-dives", "all"])
    .default("all")
    .describe("Filter by documentation category. Options: 'tutorials', 'setup', 'build', 'ui-kit', 'deep-dives', 'all'")
}).strict();

/**
 * Schema for get_push_chain_doc tool
 * Retrieves the full content of a specific documentation file
 */
export const GetDocInputSchema = z.object({
  path: z.string()
    .min(1, "Path is required")
    .max(500, "Path must not exceed 500 characters")
    .regex(/^docs\/chain\/.*\.mdx$/, "Path must be a valid .mdx file in docs/chain/ directory")
    .describe("The path to the documentation file (e.g., 'docs/chain/01-Intro-Push-Chain.mdx')"),
  response_format: z.enum(["markdown", "json"])
    .default("markdown")
    .describe("Output format: 'markdown' for human-readable text or 'json' for structured data")
}).strict();

/**
 * Schema for search_push_chain_docs tool
 * Searches through Push Chain documentation for specific topics or keywords
 */
export const SearchDocsInputSchema = z.object({
  query: z.string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search query to match against file names, paths, and content (e.g., 'wallet setup', 'smart contract', 'ERC-20')"),
  limit: z.coerce.number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(20)
    .describe("Maximum number of results to return (default: 20)"),
  response_format: z.enum(["markdown", "json"])
    .default("markdown")
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

/**
 * Schema for get_code_snippets tool
 * Extracts code snippets from Push Chain documentation files
 */
export const GetCodeSnippetsInputSchema = z.object({
  path: z.string()
    .max(500, "Path must not exceed 500 characters")
    .regex(/^docs\/chain\/.*\.mdx$/, "Path must be a valid .mdx file in docs/chain/ directory")
    .optional()
    .describe("Optional: specific doc path to extract snippets from. If not provided, extracts from all docs"),
  language: z.string()
    .max(50, "Language must not exceed 50 characters")
    .regex(/^[a-z0-9]+$/i, "Language must contain only alphanumeric characters")
    .optional()
    .describe("Optional: filter by programming language (e.g., 'javascript', 'typescript', 'solidity', 'bash')"),
  limit: z.coerce.number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(50)
    .describe("Maximum number of code snippets to return (default: 50)")
}).strict();
