#!/usr/bin/env node

/**
 * Push Chain Unified MCP Server
 *
 * Provides comprehensive access to both Push Chain documentation and SDK
 * (@pushchain/core and @pushchain/ui-kit) with enhanced validation,
 * error handling, and response formatting.
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { ZodError } from "zod";

// Import schemas
import {
  ListDocsInputSchema,
  GetDocInputSchema,
  SearchDocsInputSchema,
  GetCodeSnippetsInputSchema
} from "./schemas/docs-schemas.js";
import {
  GetSdkApiInputSchema,
  SearchSdkInputSchema,
  GetPackageInfoInputSchema,
  GetTypeDefinitionInputSchema,
  GetSourceFileInputSchema,
  ListAllExportsInputSchema,
  FindUsageExamplesInputSchema,
  GetCoreClassesInputSchema,
  GetUIComponentsInputSchema
} from "./schemas/sdk-schemas.js";

// Import utilities
import { CHARACTER_LIMIT, CACHE_TTL, GITHUB_CONFIG } from "./utils/constants.js";
import {
  enforceCharacterLimit,
  formatPaginationMetadata,
  formatPaginationText,
  truncateArray,
  sanitizeInput
} from "./utils/response-formatter.js";
import {
  handleGitHubApiError,
  handleSdkError,
  handleValidationError,
  createErrorResponse,
  createSuccessResponse
} from "./utils/error-handler.js";
import { zodToMcpSchema } from "./utils/schema-converter.js";

// Import auto-updater
import { checkAndUpdate } from "./sdk-updater.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GitHub authentication
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// ============================================================================
// DOCUMENTATION SERVER COMPONENTS
// ============================================================================

let docsCache = null;

// Load documentation from cached JSON file (similar to SDK data)
try {
  const docsCacheData = JSON.parse(readFileSync(resolve(__dirname, "data/docs_cache.json"), "utf-8"));
  docsCache = docsCacheData.docs || [];

  console.error("✓ Loaded documentation data successfully");
  console.error(`  - ${docsCache.length} documentation files`);
  console.error(`  - Generated at: ${new Date(docsCacheData.generatedAt).toLocaleString()}`);
} catch (error) {
  console.error("⚠️  Warning: Could not load cached documentation data");
  console.error(`   ${error.message}`);
  console.error("   Run 'node generate-docs-data.js' to generate documentation cache");
  docsCache = [];
}

function getDocFiles() {
  return docsCache;
}

async function fetchFileContent(downloadUrl) {
  try {
    const headers = {
      'Accept': 'application/vnd.github.raw',
      'User-Agent': 'Push-Chain-MCP-Server'
    };

    if (GITHUB_TOKEN) {
      // Support both classic (ghp_) and fine-grained (github_pat_) tokens
      const authScheme = GITHUB_TOKEN.startsWith('github_pat_') ? 'Bearer' : 'token';
      headers['Authorization'] = `${authScheme} ${GITHUB_TOKEN}`;
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

// ============================================================================
// SDK SERVER COMPONENTS
// ============================================================================

let fileContents = null;
let exportsData = null;
let packagesData = null;

try {
  // sdkData not currently used but kept for future features
  JSON.parse(readFileSync(resolve(__dirname, "data/sdk_complete_analysis.json"), "utf-8"));
  fileContents = JSON.parse(readFileSync(resolve(__dirname, "data/sdk_file_contents.json"), "utf-8"));
  exportsData = JSON.parse(readFileSync(resolve(__dirname, "data/sdk_complete_exports.json"), "utf-8"));
  packagesData = JSON.parse(readFileSync(resolve(__dirname, "data/sdk_packages_complete.json"), "utf-8"));

  console.error("✓ Loaded SDK data successfully");
  console.error(`  - ${Object.keys(fileContents).length} source files`);
  console.error(`  - ${exportsData.functions.length} functions`);
  console.error(`  - ${exportsData.classes.length} classes`);
  console.error(`  - ${exportsData.types.length} types`);
  console.error(`  - ${exportsData.interfaces.length} interfaces`);
} catch (error) {
  console.error("Error loading SDK data:", error.message);
  console.error("Please ensure SDK data files are present in the same directory.");
  process.exit(1);
}

function filterByPackage(path) {
  return path.includes("packages/core/") || path.includes("packages/ui-kit/");
}

const coreAndUIKitFiles = Object.fromEntries(
  Object.entries(fileContents).filter(([path]) => filterByPackage(path))
);

const coreAndUIKitExports = {
  functions: exportsData.functions.filter(e => filterByPackage(e.file)),
  classes: exportsData.classes.filter(e => filterByPackage(e.file)),
  types: exportsData.types.filter(e => filterByPackage(e.file)),
  interfaces: exportsData.interfaces.filter(e => filterByPackage(e.file)),
  constants: (exportsData.constants || []).filter(e => filterByPackage(e.file))
};

const coreAndUIKitPackages = packagesData.packages.filter(p =>
  p.name === "@pushchain/core" || p.name === "@pushchain/ui-kit"
);

console.error(`\nFiltered for @pushchain/core and @pushchain/ui-kit:`);
console.error(`  - ${Object.keys(coreAndUIKitFiles).length} files`);
console.error(`  - ${coreAndUIKitExports.functions.length} functions`);
console.error(`  - ${coreAndUIKitExports.classes.length} classes`);
console.error(`  - ${coreAndUIKitExports.types.length} types`);
console.error(`  - ${coreAndUIKitExports.interfaces.length} interfaces`);
console.error(`  - ${coreAndUIKitExports.constants.length} constants`);

// SDK helper functions
function findExport(name, packageFilter = null) {
  const results = [];

  for (const [type, exports] of Object.entries(coreAndUIKitExports)) {
    for (const exp of exports) {
      if (exp.name === name) {
        if (!packageFilter || exp.file.includes(`packages/${packageFilter}/`)) {
          results.push({ ...exp, exportType: type });
        }
      }
    }
  }

  return results;
}

function searchInCode(query, scope = "all") {
  const results = {
    exports: [],
    files: [],
    codeMatches: []
  };

  const lowerQuery = query.toLowerCase();

  // Search exports
  if (scope === "all" || scope === "exports" || scope === "types") {
    for (const [type, exports] of Object.entries(coreAndUIKitExports)) {
      for (const exp of exports) {
        if (exp.name.toLowerCase().includes(lowerQuery)) {
          results.exports.push({ ...exp, exportType: type });
        }
      }
    }
  }

  // Search file paths and content
  if (scope === "all" || scope === "code") {
    for (const [path, content] of Object.entries(coreAndUIKitFiles)) {
      if (path.toLowerCase().includes(lowerQuery)) {
        results.files.push({ path, reason: "path match" });
      } else if (content.toLowerCase().includes(lowerQuery)) {
        const lines = content.split('\n');
        const matchingLines = [];
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(lowerQuery)) {
            matchingLines.push({
              lineNumber: idx + 1,
              line: line.trim(),
              context: lines.slice(Math.max(0, idx - 2), idx + 3).join('\n')
            });
          }
        });

        if (matchingLines.length > 0) {
          results.codeMatches.push({
            path,
            matches: matchingLines.slice(0, 5)
          });
        }
      }
    }
  }

  return results;
}

function getPackageByName(packageName) {
  const pkgMap = {
    "core": "@pushchain/core",
    "ui-kit": "@pushchain/ui-kit"
  };

  const fullName = pkgMap[packageName] || packageName;
  return coreAndUIKitPackages.find(p => p.name === fullName);
}

function extractMethodsFromClass(sourceCode, className) {
  const methods = [];
  const methodPattern = new RegExp(`(?:async\\s+)?(?:public\\s+|private\\s+|protected\\s+)?(\\w+)\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*{`, 'g');

  let match;
  while ((match = methodPattern.exec(sourceCode)) !== null) {
    const methodName = match[1];
    if (methodName !== 'constructor' && methodName !== className) {
      methods.push(methodName);
    }
  }

  return methods;
}

// ============================================================================
// UNIFIED MCP SERVER
// ============================================================================

const server = new Server(
  {
    name: "push-chain-unified",
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
 * List all available tools (Documentation + SDK)
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ====== DOCUMENTATION TOOLS ======
      {
        name: "list_push_chain_docs",
        description: `List all available Push Chain documentation files with optional category filtering.

Returns comprehensive catalog of .mdx documentation files organized by category.

Args:
  - category (optional string): Filter by 'tutorials', 'setup', 'build', 'ui-kit', 'deep-dives', or 'all' (default)

Use when: "Show me all documentation", "What tutorials exist?", "List UI Kit docs"`,
        inputSchema: zodToMcpSchema(ListDocsInputSchema, 'ListDocsInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },
      {
        name: "get_push_chain_doc",
        description: `Get full content of a specific Push Chain documentation file.

Retrieves complete MDX content including code examples and best practices.

Args:
  - path (required string): Documentation file path (e.g., 'docs/chain/01-Intro-Push-Chain.mdx')
  - response_format (optional string): 'markdown' (default) or 'json'

Use when: "Show me the intro guide", "Get wallet setup documentation"`,
        inputSchema: zodToMcpSchema(GetDocInputSchema, 'GetDocInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },
      {
        name: "search_push_chain_docs",
        description: `Search Push Chain documentation for specific topics or keywords.

Searches filenames, paths, and content with ranked results.

Args:
  - query (required string): Search query (e.g., 'wallet setup', 'smart contract')
  - limit (optional number): Max results, 1-50 (default: 20)
  - response_format (optional string): 'markdown' (default) or 'json'

Use when: "Find docs about wallets", "Search for transaction examples"`,
        inputSchema: zodToMcpSchema(SearchDocsInputSchema, 'SearchDocsInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },
      {
        name: "get_code_snippets",
        description: `Extract code snippets from Push Chain documentation.

Finds implementation examples across all documentation.

Args:
  - path (optional string): Specific doc path to extract from
  - language (optional string): Filter by language (e.g., 'typescript', 'solidity')
  - limit (optional number): Max snippets, 1-100 (default: 50)

Use when: "Show me TypeScript examples", "Get all Solidity code from docs"`,
        inputSchema: zodToMcpSchema(GetCodeSnippetsInputSchema, 'GetCodeSnippetsInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },

      // ====== SDK TOOLS ======
      {
        name: "get_sdk_api",
        description: `Get detailed information about any exported API from @pushchain/core or @pushchain/ui-kit.

Returns source code, signature, and type information.

Args:
  - name (required string): API name (e.g., 'PushClient', 'createUniversalSigner')
  - package (optional string): 'core', 'ui-kit', or 'any' (default)

Use when: "How do I use PushClient?", "Show me UniversalAccount type"`,
        inputSchema: zodToMcpSchema(GetSdkApiInputSchema, 'GetSdkApiInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "search_sdk",
        description: `Search across all SDK code, types, and exports.

Searches function names, class names, file paths, and code content.

Args:
  - query (required string): Search query (e.g., 'wallet', 'transaction')
  - scope (optional string): 'all' (default), 'exports', 'code', or 'types'
  - limit (optional number): Max results per category, 1-100 (default: 20)
  - offset (optional number): Pagination offset (default: 0)

Use when: "Find wallet-related APIs", "Search for transaction code"`,
        inputSchema: zodToMcpSchema(SearchSdkInputSchema, 'SearchSdkInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "get_package_info",
        description: `Get complete information about @pushchain/core or @pushchain/ui-kit.

Returns package metadata, dependencies, and export statistics.

Args:
  - package (required string): 'core' or 'ui-kit'

Use when: "What's in @pushchain/core?", "Show me UI kit package info"`,
        inputSchema: zodToMcpSchema(GetPackageInfoInputSchema, 'GetPackageInfoInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "get_type_definition",
        description: `Get TypeScript type definition with full source code.

Retrieves complete type or interface definition.

Args:
  - name (required string): Type/interface name (e.g., 'UniversalAccount')

Use when: "What fields does UniversalAccount have?", "Show me SignerOptions type"`,
        inputSchema: zodToMcpSchema(GetTypeDefinitionInputSchema, 'GetTypeDefinitionInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "get_source_file",
        description: `Get complete source code of any file from @pushchain/core or @pushchain/ui-kit.

Returns full TypeScript/JavaScript source with syntax highlighting.

Args:
  - path (required string): File path (e.g., 'packages/core/src/lib/push-client/push-client.ts')

Use when: "Show me the complete PushClient source", "Read the full wallet implementation"`,
        inputSchema: zodToMcpSchema(GetSourceFileInputSchema, 'GetSourceFileInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "list_all_exports",
        description: `List all exported APIs organized by type.

Provides comprehensive catalog of functions, classes, types, and interfaces.

Args:
  - package (required string): 'core', 'ui-kit', or 'both'
  - type (optional string): 'all' (default), 'functions', 'classes', 'types', or 'interfaces'

Use when: "What functions are in @pushchain/core?", "Show all UI kit components"`,
        inputSchema: zodToMcpSchema(ListAllExportsInputSchema, 'ListAllExportsInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "find_usage_examples",
        description: `Find real usage examples of an API across the codebase.

Shows how functions, classes, and types are actually used.

Args:
  - api_name (required string): API name (e.g., 'PushClient', 'createUniversalSigner')
  - limit (optional number): Max examples, 1-50 (default: 20)

Use when: "How is PushClient used?", "Show examples of createUniversalSigner"`,
        inputSchema: zodToMcpSchema(FindUsageExamplesInputSchema, 'FindUsageExamplesInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "get_core_classes",
        description: `Get all main classes from @pushchain/core with methods and purposes.

Returns comprehensive information about core SDK classes.

Args: None required

Use when: "What classes are in @pushchain/core?", "Show me main SDK classes"`,
        inputSchema: zodToMcpSchema(GetCoreClassesInputSchema, 'GetCoreClassesInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      {
        name: "get_ui_components",
        description: `Get all React components and hooks from @pushchain/ui-kit.

Returns information about UI components, hooks, and providers.

Args: None required

Use when: "What components are in the UI kit?", "Show me all React hooks"`,
        inputSchema: zodToMcpSchema(GetUIComponentsInputSchema, 'GetUIComponentsInput'),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      }
    ]
  };
});

/**
 * Handle tool calls (Documentation + SDK)
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let params;

    // ====== DOCUMENTATION TOOL HANDLERS ======
    switch (name) {
      case "list_push_chain_docs": {
        // Validate parameters (ZodError will bubble up to outer catch)
        params = ListDocsInputSchema.parse(args);

        try {
          const docs = getDocFiles();
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
        // Validate parameters (ZodError will bubble up to outer catch)
        params = GetDocInputSchema.parse(args);

        try {
          const docs = getDocFiles();
          const doc = docs.find(d => d.path === params.path);

          if (!doc) {
            return createErrorResponse(
              `Documentation file not found: ${params.path}\n\nUse 'list_push_chain_docs' to see available files.`
            );
          }

          // Content is already cached in the doc object
          const content = doc.content || "";

          let response;
          if (params.response_format === "json") {
            response = JSON.stringify({
              name: doc.name,
              path: doc.path,
              url: doc.htmlUrl,
              content: content,
              metadata: doc.metadata || {},
              codeSnippets: doc.codeSnippets || []
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
        // Validate parameters (ZodError will bubble up to outer catch)

        params = SearchDocsInputSchema.parse(args);


        try {
          const docs = getDocFiles();
          const query = params.query.toLowerCase();
          const results = [];

          for (const doc of docs) {
            if (doc.name.toLowerCase().includes(query) || doc.path.toLowerCase().includes(query)) {
              results.push({ ...doc, matchType: "filename" });
            }
          }

          if (results.length < 5) {
            for (const doc of docs) {
              if (results.some(r => r.path === doc.path)) continue;
              try {
                const content = doc.content || "";
                if (content.toLowerCase().includes(query)) {
                  const lines = content.split('\n');
                  const matchingLines = lines.filter(line => line.toLowerCase().includes(query)).slice(0, 3);
                  results.push({ ...doc, matchType: "content", preview: matchingLines.join('\n') });
                }
              } catch (error) {
                console.error(`Error searching ${doc.path}:`, error.message);
              }
              if (results.length >= params.limit) break;
            }
          }

          const truncated = truncateArray(results, params.limit, "documentation files");

          const sanitizedQuery = sanitizeInput(params.query);

          let response;
          if (params.response_format === "json") {
            response = JSON.stringify({
              query: sanitizedQuery,
              results: truncated.items,
              total: truncated.total,
              showing: truncated.showing
            }, null, 2);
          } else {
            const lines = [`# Search Results: '${sanitizedQuery}'`, "", `Found ${truncated.total} matches`, ""];
            const filenameMatches = truncated.items.filter(r => r.matchType === "filename");
            const contentMatches = truncated.items.filter(r => r.matchType === "content");

            if (filenameMatches.length > 0) {
              lines.push("## Filename Matches", "");
              for (const match of filenameMatches) {
                lines.push(`- **${match.name}** (${match.path})`, `  URL: ${match.htmlUrl}`, "");
              }
            }

            if (contentMatches.length > 0) {
              lines.push("## Content Matches", "");
              for (const match of contentMatches) {
                lines.push(`- **${match.name}** (${match.path})`);
                if (match.preview) lines.push(`  Preview: \`\`\`\n${match.preview}\n\`\`\``);
                lines.push("");
              }
            }

            response = lines.join('\n');

            // Add pagination info for markdown
            response += formatPaginationText(results.length, 0, params.limit, truncated.showing);
          }

          if (results.length === 0) {
            return createSuccessResponse(`No documentation found matching '${sanitizedQuery}'.`);
          }

          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleGitHubApiError(error));
        }
      }

      case "get_code_snippets": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetCodeSnippetsInputSchema.parse(args);


        try {
          const docs = getDocFiles();
          const snippets = [];

          const targetDocs = params.path ? docs.filter(d => d.path === params.path) : docs;

          for (const doc of targetDocs) {
            try {
              // Code snippets are already cached in the doc object
              let docSnippets = doc.codeSnippets || [];
              if (params.language) {
                docSnippets = docSnippets.filter(s => s.language.toLowerCase() === params.language.toLowerCase());
              }

              for (const snippet of docSnippets) {
                snippets.push({ source: doc.path, language: snippet.language, code: snippet.code.trim() });
              }

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
            snippets: truncated.items
          }, null, 2);

          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleGitHubApiError(error));
        }
      }

      // ====== SDK TOOL HANDLERS ======
      case "get_sdk_api": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetSdkApiInputSchema.parse(args);


        try {
          const exports = findExport(params.name, params.package === "any" ? null : params.package);

          if (exports.length === 0) {
            return createErrorResponse(
              `API "${params.name}" not found. Try 'search_sdk' or 'list_all_exports'.`
            );
          }

          const results = [];
          for (const exp of exports) {
            const sourceCode = coreAndUIKitFiles[exp.file] || "";
            const pkg = exp.file.includes("/core/") ? "@pushchain/core" : "@pushchain/ui-kit";

            let definition = "";

            if (exp.exportType === "classes") {
              const classPattern = new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|$))`, 'm');
              const match = sourceCode.match(classPattern);
              if (match) {
                definition = match[0].length > 5000 ? match[0].substring(0, 5000) + "\n  // ... (truncated)\n}" : match[0];
              }
            } else if (exp.exportType === "functions") {
              const funcPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|const|let|var|function|class|type|interface|$))`, 'm');
              const match = sourceCode.match(funcPattern);
              if (match) {
                definition = match[0].length > 3000 ? match[0].substring(0, 3000) + "\n  // ... (truncated)\n}" : match[0];
              }
            } else if (exp.exportType === "types" || exp.exportType === "interfaces") {
              const typePattern = new RegExp(`export\\s+(?:type|interface)\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|const|let|var|function|class|type|interface|$))`, 'm');
              const match = sourceCode.match(typePattern);
              if (match) definition = match[0];
            }

            if (!definition) {
              const lines = sourceCode.split('\n');
              const exportLineIndex = lines.findIndex(line => line.includes(`export`) && line.includes(params.name));
              if (exportLineIndex !== -1) {
                definition = lines.slice(exportLineIndex, Math.min(exportLineIndex + 30, lines.length)).join('\n');
                definition += "\n// ... (use get_source_file for complete code)";
              }
            }

            results.push({
              name: exp.name,
              type: exp.exportType,
              package: pkg,
              file: exp.file,
              definition: definition || "// Use get_source_file to view complete file.",
              note: "Use get_source_file with the file path for complete source"
            });
          }

          const response = JSON.stringify(results, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_sdk_api"));
        }
      }

      case "search_sdk": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = SearchSdkInputSchema.parse(args);


        try {
          const results = searchInCode(params.query, params.scope || "all", params.limit, params.offset);

          const exportsTruncated = truncateArray(results.exports, params.limit, "export matches");
          const filesTruncated = truncateArray(results.files, params.limit, "file matches");
          const codeTruncated = truncateArray(results.codeMatches, params.limit, "code matches");

          const sanitizedQuery = sanitizeInput(params.query);

          const summary = {
            query: sanitizedQuery,
            scope: params.scope || "all",
            results: {
              exports: exportsTruncated.items,
              files: filesTruncated.items,
              codeMatches: codeTruncated.items
            },
            totalFound: {
              exports: results.exports.length,
              files: results.files.length,
              codeMatches: results.codeMatches.length
            },
            pagination: formatPaginationMetadata(
              results.exports.length + results.files.length + results.codeMatches.length,
              params.offset,
              params.limit
            )
          };

          const response = JSON.stringify(summary, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "search_sdk"));
        }
      }

      case "get_package_info": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetPackageInfoInputSchema.parse(args);


        try {
          const pkg = getPackageByName(params.package);

          if (!pkg) {
            return createErrorResponse(`Package "${params.package}" not found. Valid: 'core' or 'ui-kit'`);
          }

          const packageExports = {
            functions: coreAndUIKitExports.functions.filter(e => e.file.includes(`packages/${params.package}/`)),
            classes: coreAndUIKitExports.classes.filter(e => e.file.includes(`packages/${params.package}/`)),
            types: coreAndUIKitExports.types.filter(e => e.file.includes(`packages/${params.package}/`)),
            interfaces: coreAndUIKitExports.interfaces.filter(e => e.file.includes(`packages/${params.package}/`)),
            constants: coreAndUIKitExports.constants.filter(e => e.file.includes(`packages/${params.package}/`))
          };

          const info = {
            ...pkg,
            statistics: {
              totalExports: Object.values(packageExports).reduce((sum, arr) => sum + arr.length, 0),
              functions: packageExports.functions.length,
              classes: packageExports.classes.length,
              types: packageExports.types.length,
              interfaces: packageExports.interfaces.length,
              constants: packageExports.constants.length
            },
            topExports: {
              functions: packageExports.functions.slice(0, 10).map(e => e.name),
              classes: packageExports.classes.slice(0, 10).map(e => e.name),
              types: packageExports.types.slice(0, 10).map(e => e.name),
              interfaces: packageExports.interfaces.slice(0, 10).map(e => e.name),
              constants: packageExports.constants.slice(0, 10).map(e => e.name)
            }
          };

          const response = JSON.stringify(info, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_package_info"));
        }
      }

      case "get_type_definition": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetTypeDefinitionInputSchema.parse(args);


        try {
          const types = [...coreAndUIKitExports.types, ...coreAndUIKitExports.interfaces]
            .filter(t => t.name === params.name);

          if (types.length === 0) {
            return createErrorResponse(`Type "${params.name}" not found. Try 'search_sdk' to find similar types.`);
          }

          const results = types.map(type => {
            const sourceCode = coreAndUIKitFiles[type.file] || "";
            const pkg = type.file.includes("/core/") ? "@pushchain/core" : "@pushchain/ui-kit";

            const typePattern = new RegExp(`export\\s+(?:type|interface)\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|const|let|var|function|class|type|interface|$))`, 'm');
            const match = sourceCode.match(typePattern);

            return {
              name: type.name,
              type: type.type || "type",
              package: pkg,
              file: type.file,
              definition: match ? match[0] : `// Definition found in ${type.file}`,
              fullSource: sourceCode
            };
          });

          const response = JSON.stringify(results, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_type_definition"));
        }
      }

      case "get_source_file": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetSourceFileInputSchema.parse(args);


        try {
          const sourceCode = coreAndUIKitFiles[params.path];

          if (!sourceCode) {
            return createErrorResponse(`File "${params.path}" not found in @pushchain/core or @pushchain/ui-kit.`);
          }

          const response = `# ${params.path}\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``;
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_source_file"));
        }
      }

      case "list_all_exports": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = ListAllExportsInputSchema.parse(args);


        try {
          let packageFilter = null;
          if (params.package !== "both") packageFilter = params.package;

          const typeFilter = params.type || "all";
          const exports = {};

          for (const [type, items] of Object.entries(coreAndUIKitExports)) {
            if (typeFilter === "all" || type === typeFilter) {
              exports[type] = items
                .filter(e => !packageFilter || e.file.includes(`packages/${packageFilter}/`))
                .map(e => ({
                  name: e.name,
                  package: e.file.includes("/core/") ? "@pushchain/core" : "@pushchain/ui-kit",
                  file: e.file
                }));
            }
          }

          const response = JSON.stringify(exports, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "list_all_exports"));
        }
      }

      case "find_usage_examples": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = FindUsageExamplesInputSchema.parse(args);


        try {
          const examples = [];

          for (const [path, content] of Object.entries(coreAndUIKitFiles)) {
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.includes(params.api_name) && !line.trim().startsWith('//')) {
                examples.push({
                  file: path,
                  lineNumber: idx + 1,
                  line: line.trim(),
                  context: lines.slice(Math.max(0, idx - 3), idx + 4).join('\n')
                });
              }
            });

            if (examples.length >= params.limit) break;
          }

          const truncated = truncateArray(examples, params.limit, "usage examples");
          const result = {
            api: params.api_name,
            totalExamples: truncated.total,
            showing: truncated.showing,
            examples: truncated.items
          };

          const response = JSON.stringify(result, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "find_usage_examples"));
        }
      }

      case "get_core_classes": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetCoreClassesInputSchema.parse(args);


        try {
          const coreClasses = coreAndUIKitExports.classes
            .filter(c => c.file.includes("packages/core/"))
            .map(c => {
              const sourceCode = coreAndUIKitFiles[c.file] || "";
              const methods = extractMethodsFromClass(sourceCode, c.name);

              const classSignaturePattern = new RegExp(
                `export\\s+(?:abstract\\s+)?class\\s+${c.name}[^{]*\\{[\\s\\S]{0,800}`,
                'm'
              );
              const match = sourceCode.match(classSignaturePattern);
              const classSignature = match ? match[0] + "\n  // ... (truncated)\n}" : "";

              return {
                name: c.name,
                file: c.file,
                methods: methods,
                signature: classSignature,
                methodCount: methods.length,
                note: "Use get_sdk_api or get_source_file for more details"
              };
            });

          const result = {
            totalClasses: coreClasses.length,
            classes: coreClasses,
            note: "Use get_sdk_api(name: 'ClassName') for detailed info"
          };

          const response = JSON.stringify(result, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_core_classes"));
        }
      }

      case "get_ui_components": {
        // Validate parameters (ZodError will bubble up to outer catch)

        params = GetUIComponentsInputSchema.parse(args);


        try {
          const uiExports = { components: [], hooks: [], providers: [] };

          for (const func of coreAndUIKitExports.functions) {
            if (func.file.includes("packages/ui-kit/")) {
              const sourceCode = coreAndUIKitFiles[func.file] || "";
              const funcPattern = new RegExp(`export\\s+(?:const\\s+)?${func.name}[\\s\\S]{0,500}`, 'm');
              const match = sourceCode.match(funcPattern);
              const signature = match ? match[0] + "..." : "";

              if (func.name.startsWith("use")) {
                uiExports.hooks.push({ name: func.name, file: func.file, signature });
              } else if (func.name.includes("Provider")) {
                uiExports.providers.push({ name: func.name, file: func.file, signature });
              } else {
                uiExports.components.push({ name: func.name, file: func.file, signature });
              }
            }
          }

          const result = {
            summary: {
              totalComponents: uiExports.components.length,
              totalHooks: uiExports.hooks.length,
              totalProviders: uiExports.providers.length
            },
            ...uiExports,
            note: "Use get_sdk_api or get_source_file for detailed information"
          };

          const response = JSON.stringify(result, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);
        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_ui_components"));
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, handleValidationError(error));
    }

    // Re-throw McpError instances (these are expected/handled errors)
    if (error instanceof McpError) {
      throw error;
    }

    // Log unexpected errors only
    console.error("Unexpected tool execution error:", error);

    // Handle other errors
    throw new McpError(ErrorCode.InternalError, `Unexpected error: ${error.message}`);
  }
});

/**
 * List resources (Documentation + SDK files)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const docs = getDocFiles();
    const resources = [];

    // Add documentation resources
    for (const doc of docs) {
      resources.push({
        uri: `pushchain://docs/${doc.path}`,
        name: doc.name,
        description: `Push Chain documentation: ${doc.path}`,
        mimeType: "text/markdown"
      });
    }

    // Add SDK file resources
    for (const path of Object.keys(coreAndUIKitFiles)) {
      const pkg = path.includes("/core/") ? "core" : "ui-kit";
      resources.push({
        uri: `pushchain://sdk/${pkg}/${path}`,
        name: path.split('/').pop(),
        description: `SDK source: ${path}`,
        mimeType: "text/typescript"
      });
    }

    return { resources };
  } catch (error) {
    console.error("Error listing resources:", error);
    return { resources: [] };
  }
});

/**
 * Read resource content (Documentation + SDK)
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri.startsWith("pushchain://docs/")) {
    const path = uri.replace("pushchain://docs/", "");
    try {
      const docs = getDocFiles();
      const doc = docs.find(d => d.path === path);
      if (!doc) throw new Error(`Documentation not found: ${path}`);

      const content = doc.content || "";
      return {
        contents: [{ uri, mimeType: "text/markdown", text: content }]
      };
    } catch (error) {
      throw new Error(handleGitHubApiError(error));
    }
  } else if (uri.startsWith("pushchain://sdk/")) {
    const path = uri.replace(/^pushchain:\/\/sdk\/(?:core|ui-kit)\//, "");
    const content = coreAndUIKitFiles[path];
    if (!content) throw new Error(`Resource not found: ${path}`);

    return {
      contents: [{ uri, mimeType: "text/typescript", text: content }]
    };
  } else {
    throw new Error(`Invalid URI: ${uri}`);
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("=".repeat(60));
  console.error("Push Chain Unified MCP Server");
  console.error("=".repeat(60));
  console.error("\n📚 Documentation Server:");
  console.error(`   - ${getDocFiles().length} documentation files`);

  console.error("\n🔧 SDK Server:");
  console.error(`   - ${Object.keys(coreAndUIKitFiles).length} source files`);
  console.error(`   - ${coreAndUIKitExports.functions.length} functions`);
  console.error(`   - ${coreAndUIKitExports.classes.length} classes`);
  console.error(`   - ${coreAndUIKitExports.types.length} types`);

  console.error("\n⚙️  Configuration:");
  console.error(`   - CHARACTER_LIMIT: ${CHARACTER_LIMIT}`);

  // Check for SDK updates
  if (process.env.SDK_AUTO_UPDATE !== "false") {
    console.error("\n🔄 Checking for SDK updates...");
    checkAndUpdate(false).catch(error => {
      console.error("   Update check failed:", error.message);
    });
  }

  console.error("\n" + "=".repeat(60));
  console.error("✅ Server ready on stdio");
  console.error("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
