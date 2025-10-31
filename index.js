#!/usr/bin/env node

/**
 * Push Chain Documentation MCP Server (Improved)
 *
 * Provides comprehensive access to Push Chain documentation from GitHub
 * with enhanced validation, error handling, and response formatting.
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { ZodError } from "zod";

// Import schemas
import {
  ListDocsInputSchema,
  GetDocInputSchema,
  SearchDocsInputSchema,
  GetCodeSnippetsInputSchema
} from "./schemas/docs-schemas.js";

// Import utilities
import { CHARACTER_LIMIT, CACHE_TTL, GITHUB_CONFIG } from "./utils/constants.js";
import {
  enforceCharacterLimit,
  formatPaginationMetadata,
  truncateArray
} from "./utils/response-formatter.js";
import {
  handleGitHubApiError,
  handleValidationError,
  createErrorResponse,
  createSuccessResponse
} from "./utils/error-handler.js";

// GitHub authentication
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// Cache for documentation files
let docsCache = null;
let cacheTimestamp = null;

/**
 * Check if a file should be included
 */
function shouldIncludeFile(filename) {
  if (filename.endsWith(".mdx.deprecated")) return false;
  if (filename.toUpperCase().includes("CHANGELOG")) return false;
  return filename.endsWith(".mdx");
}

/**
 * Fetch contents from GitHub API
 */
async function fetchGitHubContents(path) {
  const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
  const params = new URLSearchParams({ ref: GITHUB_CONFIG.branch });

  try {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Push-Chain-MCP-Server'
    };

    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(`${url}?${params}`, { headers });
    if (!response.ok) {
      const error = new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      error.response = { status: response.status };
      throw error;
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${path}:`, error.message);
    throw error;
  }
}

/**
 * Recursively fetch all .mdx files
 */
async function fetchAllMdxFiles(path = GITHUB_CONFIG.basePath) {
  const files = [];
  const contents = await fetchGitHubContents(path);

  if (!Array.isArray(contents)) {
    return files;
  }

  for (const item of contents) {
    if (item.type === "file" && shouldIncludeFile(item.name)) {
      files.push({
        name: item.name,
        path: item.path,
        downloadUrl: item.download_url,
        htmlUrl: item.html_url,
        sha: item.sha
      });
    } else if (item.type === "dir") {
      const subFiles = await fetchAllMdxFiles(item.path);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Get cached documentation files or fetch fresh
 */
async function getDocFiles() {
  const now = Date.now();

  if (docsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return docsCache;
  }

  console.error("Fetching documentation files from GitHub...");
  docsCache = await fetchAllMdxFiles();
  cacheTimestamp = now;
  console.error(`Cached ${docsCache.length} documentation files`);

  return docsCache;
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(downloadUrl) {
  try {
    const headers = {
      'Accept': 'application/vnd.github.raw',
      'User-Agent': 'Push-Chain-MCP-Server'
    };

    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) {
      const error = new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      error.response = { status: response.status };
      throw error;
    }
    return await response.text();
  } catch (error) {
    throw error;
  }
}

/**
 * Extract metadata and structure from MDX content
 */
function parseDocumentation(content, path) {
  const lines = content.split('\n');
  const metadata = {};
  let description = '';
  let codeSnippets = [];
  let inCodeBlock = false;
  let currentCodeBlock = { language: '', code: '' };

  // Extract frontmatter if exists
  if (lines[0]?.trim() === '---') {
    let i = 1;
    while (i < lines.length && lines[i].trim() !== '---') {
      const line = lines[i];
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
      i++;
    }
  }

  // Extract first paragraph as description
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('import')) {
      description = line.trim();
      break;
    }
  }

  // Extract code snippets
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        currentCodeBlock.language = line.slice(3).trim() || 'text';
        currentCodeBlock.code = '';
      } else {
        inCodeBlock = false;
        codeSnippets.push({ ...currentCodeBlock });
        currentCodeBlock = { language: '', code: '' };
      }
    } else if (inCodeBlock) {
      currentCodeBlock.code += line + '\n';
    }
  }

  return {
    metadata,
    description: description || metadata.title || path,
    codeSnippets,
    fullContent: content
  };
}

/**
 * Create MCP server
 */
const server = new Server(
  {
    name: "push-chain-docs",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_push_chain_docs",
        description: `List all available Push Chain documentation files with optional category filtering.

This tool fetches the complete catalog of .mdx documentation files from the Push Chain GitHub repository. Use this to discover available documentation before fetching specific content.

Args:
  - category (optional string): Filter by category. Options: 'tutorials', 'setup', 'build', 'ui-kit', 'deep-dives', 'all' (default: 'all')

Returns (JSON format):
  {
    "total": number,                    // Total matching documentation files
    "categories": {
      "tutorials": Array<{              // Organized by category
        "name": string,                 // File name (e.g., "01-Intro-Push-Chain.mdx")
        "path": string,                 // Full path in repository
        "downloadUrl": string,          // Raw file download URL
        "htmlUrl": string              // GitHub web view URL
      }>,
      "setup": [...],
      "build": [...],
      "ui-kit": [...],
      "deep-dives": [...],
      "other": [...]
    },
    "message": string                   // Summary message
  }

Examples:
  - Use when: "Show me all available Push Chain documentation" -> No parameters
  - Use when: "What UI Kit documentation exists?" -> {"category": "ui-kit"}
  - Use when: "List setup guides" -> {"category": "setup"}
  - Don't use when: You want actual document content (use get_push_chain_doc instead)

Error Handling:
  - Returns empty categories if GitHub API fails or is rate limited
  - Uses 30-minute cache to minimize API requests
  - Returns "Error: GitHub API rate limit exceeded" if rate limited (wait ~1 hour)`,
        inputSchema: ListDocsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
        }
      },
      {
        name: "get_push_chain_doc",
        description: `Get the full content of a specific Push Chain documentation file.

Retrieves complete MDX content including code snippets, examples, and best practices from a specific documentation file.

Args:
  - path (required string): Path to documentation file (e.g., 'docs/chain/01-Intro-Push-Chain.mdx')
  - response_format (optional string): Output format - 'markdown' for human-readable (default) or 'json' for structured data

Returns (Markdown format - default):
  # [Document Title]

  Path: [file path]
  URL: [GitHub URL]

  ---

  [Full MDX content with formatting preserved]

Returns (JSON format):
  {
    "name": string,                     // File name
    "path": string,                     // Repository path
    "url": string,                      // GitHub URL
    "content": string,                  // Full MDX content
    "metadata": object,                 // Frontmatter metadata
    "codeSnippets": Array<{            // Extracted code blocks
      "language": string,
      "code": string
    }>
  }

Examples:
  - Use when: "Show me the intro to Push Chain" -> {"path": "docs/chain/01-Intro-Push-Chain.mdx"}
  - Use when: "Get wallet setup documentation" -> Search first, then use path from results
  - Don't use when: You don't know the exact path (use search_push_chain_docs first)

Error Handling:
  - Returns "Error: Documentation file not found" if path doesn't exist
  - Returns "Error: GitHub API rate limit exceeded" if rate limited
  - Suggests using list_push_chain_docs to find valid paths`,
        inputSchema: GetDocInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
        }
      },
      {
        name: "search_push_chain_docs",
        description: `Search Push Chain documentation for specific topics, keywords, or concepts.

Searches through file names, paths, and content to find relevant documentation. Matches are ranked by relevance (filename matches first, then content matches).

Args:
  - query (required string): Search query, 2-200 characters (e.g., 'wallet setup', 'smart contract', 'ERC-20')
  - limit (optional number): Maximum results to return, 1-50 (default: 20)
  - response_format (optional string): 'markdown' for human-readable (default) or 'json' for structured data

Returns (Markdown format - default):
  # Search Results: '[query]'

  Found [N] matches

  ## Filename Matches
  - [file name] ([path])
    URL: [GitHub URL]

  ## Content Matches
  - [file name] ([path])
    Preview: [matching lines context]

Returns (JSON format):
  {
    "query": string,                    // Original search query
    "results": Array<{
      "name": string,                   // File name
      "path": string,                   // Repository path
      "downloadUrl": string,
      "htmlUrl": string,
      "matchType": string,              // "filename" or "content"
      "preview"?: string                // Context snippet for content matches
    }>,
    "total": number,                    // Total matches found
    "message": string                   // Summary
  }

Examples:
  - Use when: "Find docs about wallet setup" -> {"query": "wallet setup"}
  - Use when: "Search for ERC-20 examples" -> {"query": "ERC-20", "limit": 10}
  - Use when: "Look for smart contract info" -> {"query": "smart contract"}
  - Don't use when: You know the exact file path (use get_push_chain_doc directly)

Error Handling:
  - Returns empty results with helpful message if no matches found
  - Suggests trying different search terms or browsing categories
  - Returns "Error: GitHub API rate limit exceeded" if rate limited`,
        inputSchema: SearchDocsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
        }
      },
      {
        name: "get_code_snippets",
        description: `Extract all code snippets from Push Chain documentation.

Useful for finding implementation examples and best practices across documentation files. Extracts code blocks with language detection.

Args:
  - path (optional string): Specific doc path to extract from (e.g., 'docs/chain/wallet.mdx'). If not provided, extracts from all docs
  - language (optional string): Filter by programming language (e.g., 'javascript', 'typescript', 'solidity', 'bash')
  - limit (optional number): Maximum snippets to return, 1-100 (default: 50)

Returns:
  {
    "total": number,                    // Total snippets found
    "language": string,                 // Filter applied or "all"
    "snippets": Array<{
      "source": string,                 // Documentation file path
      "language": string,               // Programming language
      "code": string                    // Code snippet content
    }>
  }

Examples:
  - Use when: "Show me all TypeScript examples" -> {"language": "typescript"}
  - Use when: "Get Solidity code from smart contract docs" -> {"language": "solidity", "path": "docs/chain/contracts.mdx"}
  - Use when: "Find all code examples" -> No parameters (returns all snippets up to limit)
  - Don't use when: You want full documentation content (use get_push_chain_doc instead)

Error Handling:
  - Returns empty array if no code snippets found
  - Suggests checking file path or language filter
  - Limited to 50 snippets by default to avoid overwhelming response`,
        inputSchema: GetCodeSnippetsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true
        }
      }
    ]
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate inputs based on tool
    let params;

    switch (name) {
      case "list_push_chain_docs": {
        try {
          params = ListDocsInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const docs = await getDocFiles();
          const category = params.category || "all";

          let filteredDocs = docs;
          if (category !== "all") {
            filteredDocs = docs.filter(doc => {
              const path = doc.path.toLowerCase();
              switch (category) {
                case "tutorials": return path.includes("/01-tutorials/");
                case "setup": return path.includes("/02-setup/");
                case "build": return path.includes("/03-build/");
                case "ui-kit": return path.includes("/04-ui-kit/");
                case "deep-dives": return path.includes("/05-deep-dives/");
                default: return true;
              }
            });
          }

          // Organize by category
          const organized = {
            tutorials: [],
            setup: [],
            build: [],
            "ui-kit": [],
            "deep-dives": [],
            other: []
          };

          for (const doc of filteredDocs) {
            const path = doc.path.toLowerCase();
            if (path.includes("/01-tutorials/")) organized.tutorials.push(doc);
            else if (path.includes("/02-setup/")) organized.setup.push(doc);
            else if (path.includes("/03-build/")) organized.build.push(doc);
            else if (path.includes("/04-ui-kit/")) organized["ui-kit"].push(doc);
            else if (path.includes("/05-deep-dives/")) organized["deep-dives"].push(doc);
            else organized.other.push(doc);
          }

          const response = JSON.stringify({
            total: filteredDocs.length,
            categories: organized,
            message: `Found ${filteredDocs.length} documentation files`
          }, null, 2);

          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleGitHubApiError(error));
        }
      }

      case "get_push_chain_doc": {
        try {
          params = GetDocInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const docs = await getDocFiles();
          const doc = docs.find(d => d.path === params.path);

          if (!doc) {
            return createErrorResponse(
              `Documentation file not found: ${params.path}\n\nUse the 'list_push_chain_docs' tool to see all available documentation files.\n\nAvailable paths:\n${docs.slice(0, 10).map(d => `  - ${d.path}`).join('\n')}\n... and ${docs.length - 10} more`
            );
          }

          const content = await fetchFileContent(doc.downloadUrl);
          const parsed = parseDocumentation(content, doc.path);

          let response;
          if (params.response_format === "json") {
            response = JSON.stringify({
              name: doc.name,
              path: doc.path,
              url: doc.htmlUrl,
              content: content,
              metadata: parsed.metadata,
              codeSnippets: parsed.codeSnippets
            }, null, 2);
          } else {
            response = `# ${doc.name}\n\nPath: ${doc.path}\nURL: ${doc.htmlUrl}\n\n---\n\n${content}`;
          }

          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleGitHubApiError(error));
        }
      }

      case "search_push_chain_docs": {
        try {
          params = SearchDocsInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const docs = await getDocFiles();
          const query = params.query.toLowerCase();
          const results = [];

          // Search through file names and paths first
          for (const doc of docs) {
            if (doc.name.toLowerCase().includes(query) ||
                doc.path.toLowerCase().includes(query)) {
              results.push({
                ...doc,
                matchType: "filename"
              });
            }
          }

          // If we have few results, search content
          if (results.length < 5) {
            for (const doc of docs) {
              if (results.some(r => r.path === doc.path)) continue;

              try {
                const content = await fetchFileContent(doc.downloadUrl);
                if (content.toLowerCase().includes(query)) {
                  // Find context around the match
                  const lines = content.split('\n');
                  const matchingLines = lines.filter(line =>
                    line.toLowerCase().includes(query)
                  ).slice(0, 3);

                  results.push({
                    ...doc,
                    matchType: "content",
                    preview: matchingLines.join('\n')
                  });
                }
              } catch (error) {
                console.error(`Error searching ${doc.path}:`, error.message);
              }

              // Stop if we have enough results
              if (results.length >= params.limit) break;
            }
          }

          const truncated = truncateArray(results, params.limit, "documentation files");

          let response;
          if (params.response_format === "json") {
            response = JSON.stringify({
              query: params.query,
              results: truncated.items,
              total: truncated.total,
              showing: truncated.showing,
              ...(truncated.truncated ? { message: truncated.message } : {}),
              summary: `Found ${truncated.total} matches for "${params.query}"`
            }, null, 2);
          } else {
            const lines = [`# Search Results: '${params.query}'`, "", `Found ${truncated.total} matches`, ""];

            const filenameMatches = truncated.items.filter(r => r.matchType === "filename");
            const contentMatches = truncated.items.filter(r => r.matchType === "content");

            if (filenameMatches.length > 0) {
              lines.push("## Filename Matches", "");
              for (const match of filenameMatches) {
                lines.push(`- **${match.name}** (${match.path})`);
                lines.push(`  URL: ${match.htmlUrl}`, "");
              }
            }

            if (contentMatches.length > 0) {
              lines.push("## Content Matches", "");
              for (const match of contentMatches) {
                lines.push(`- **${match.name}** (${match.path})`);
                if (match.preview) {
                  lines.push(`  Preview: \`\`\`\n${match.preview}\n\`\`\``);
                }
                lines.push("");
              }
            }

            if (truncated.truncated) {
              lines.push("", `---`, truncated.message);
            }

            response = lines.join('\n');
          }

          if (results.length === 0) {
            return createSuccessResponse(
              `No documentation found matching '${params.query}'.\n\nTry:\n- Using different search terms\n- Browsing by category with 'list_push_chain_docs'\n- Using more specific keywords`
            );
          }

          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleGitHubApiError(error));
        }
      }

      case "get_code_snippets": {
        try {
          params = GetCodeSnippetsInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const docs = await getDocFiles();
          const snippets = [];

          const targetDocs = params.path
            ? docs.filter(d => d.path === params.path)
            : docs;

          for (const doc of targetDocs) {
            try {
              const content = await fetchFileContent(doc.downloadUrl);
              const parsed = parseDocumentation(content, doc.path);

              let docSnippets = parsed.codeSnippets;
              if (params.language) {
                docSnippets = docSnippets.filter(s =>
                  s.language.toLowerCase() === params.language.toLowerCase()
                );
              }

              for (const snippet of docSnippets) {
                snippets.push({
                  source: doc.path,
                  language: snippet.language,
                  code: snippet.code.trim()
                });
              }

              // Stop if we've collected enough
              if (snippets.length >= params.limit) break;

            } catch (error) {
              console.error(`Error processing ${doc.path}:`, error.message);
            }
          }

          const truncated = truncateArray(snippets, params.limit, "code snippets");

          const response = JSON.stringify({
            total: truncated.total,
            showing: truncated.showing,
            language: params.language || "all",
            snippets: truncated.items,
            ...(truncated.truncated ? { message: truncated.message } : {})
          }, null, 2);

          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleGitHubApiError(error));
        }
      }

      default:
        return createErrorResponse(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return createErrorResponse(`Unexpected error: ${error.message}`);
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const docs = await getDocFiles();

    return {
      resources: docs.map(doc => ({
        uri: `pushchain://docs/${doc.path}`,
        name: doc.name,
        description: `Push Chain documentation: ${doc.path}`,
        mimeType: "text/markdown"
      }))
    };
  } catch (error) {
    console.error("Error listing resources:", error);
    return { resources: [] };
  }
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (!uri.startsWith("pushchain://docs/")) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const path = uri.replace("pushchain://docs/", "");

  try {
    const docs = await getDocFiles();
    const doc = docs.find(d => d.path === path);

    if (!doc) {
      throw new Error(`Documentation not found: ${path}`);
    }

    const content = await fetchFileContent(doc.downloadUrl);

    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: content
        }
      ]
    };
  } catch (error) {
    throw new Error(handleGitHubApiError(error));
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Push Chain Documentation MCP Server running on stdio");
  console.error(`- ${await getDocFiles().then(docs => docs.length)} documentation files cached`);
  console.error("- CHARACTER_LIMIT:", CHARACTER_LIMIT);
  console.error("- Cache TTL:", CACHE_TTL / 1000 / 60, "minutes");

  if (GITHUB_TOKEN) {
    console.error("✓ GitHub token configured (authenticated requests: 5000/hour)");
  } else {
    console.error("⚠️  WARNING: No GitHub token (rate limit: 60/hour)");
    console.error("   Set GITHUB_TOKEN environment variable to increase limits");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
