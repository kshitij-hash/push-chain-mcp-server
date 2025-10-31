#!/usr/bin/env node

/**
 * Push Chain SDK MCP Server (Improved)
 *
 * Provides comprehensive access to @pushchain/core and @pushchain/ui-kit
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
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ZodError } from "zod";

// Import schemas
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
import { CHARACTER_LIMIT } from "./utils/constants.js";
import {
  enforceCharacterLimit,
  formatPaginationMetadata,
  truncateArray
} from "./utils/response-formatter.js";
import {
  handleSdkError,
  handleValidationError,
  createErrorResponse,
  createSuccessResponse
} from "./utils/error-handler.js";

// Import auto-updater
import { checkAndUpdate } from "./sdk-updater.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GitHub authentication (for future GitHub-based SDK queries if needed)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// Load complete SDK analysis data
let sdkData = null;
let fileContents = null;
let exportsData = null;
let packagesData = null;

try {
  sdkData = JSON.parse(readFileSync(resolve(__dirname, "sdk_complete_analysis.json"), "utf-8"));
  fileContents = JSON.parse(readFileSync(resolve(__dirname, "sdk_file_contents.json"), "utf-8"));
  exportsData = JSON.parse(readFileSync(resolve(__dirname, "sdk_complete_exports.json"), "utf-8"));
  packagesData = JSON.parse(readFileSync(resolve(__dirname, "sdk_packages_complete.json"), "utf-8"));

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

/**
 * Filter data for core and ui-kit packages only
 */
function filterByPackage(path) {
  return path.includes("packages/core/") || path.includes("packages/ui-kit/");
}

// Pre-filter data
const coreAndUIKitFiles = Object.fromEntries(
  Object.entries(fileContents).filter(([path]) => filterByPackage(path))
);

const coreAndUIKitExports = {
  functions: exportsData.functions.filter(e => filterByPackage(e.file)),
  classes: exportsData.classes.filter(e => filterByPackage(e.file)),
  types: exportsData.types.filter(e => filterByPackage(e.file)),
  interfaces: exportsData.interfaces.filter(e => filterByPackage(e.file)),
  constants: exportsData.constants.filter(e => filterByPackage(e.file))
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
console.error(`  - CHARACTER_LIMIT: ${CHARACTER_LIMIT}\n`);

/**
 * Helper functions
 */
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

function searchInCode(query, scope = "all", limit = 20, offset = 0) {
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
        // Find context around match
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
            matches: matchingLines.slice(0, 5) // Limit to 5 matches per file
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

/**
 * Create MCP server
 */
const server = new Server(
  {
    name: "push-chain-sdk",
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
        name: "get_sdk_api",
        description: `Get detailed information about any exported API from @pushchain/core or @pushchain/ui-kit.

Returns source code, signature, type information, and usage context for functions, classes, types, and interfaces.

Args:
  - name (required string): API name (e.g., 'PushClient', 'createUniversalSigner', 'UniversalAccount')
  - package (optional string): Package filter - 'core' for @pushchain/core, 'ui-kit' for @pushchain/ui-kit, 'any' for both (default: 'any')

Returns:
  Array<{
    "name": string,                     // API name
    "type": string,                     // Export type: "functions", "classes", "types", or "interfaces"
    "package": string,                  // "@pushchain/core" or "@pushchain/ui-kit"
    "file": string,                     // Source file path
    "definition": string,               // Code definition/signature
    "note": string                      // Guidance for getting complete source
  }>

Examples:
  - Use when: "How do I use PushClient?" -> {"name": "PushClient", "package": "core"}
  - Use when: "Show me the UniversalAccount type" -> {"name": "UniversalAccount"}
  - Use when: "What is createUniversalSigner?" -> {"name": "createUniversalSigner"}
  - Don't use when: You want the complete file source (use get_source_file instead)

Error Handling:
  - Returns error if API not found with suggestions to use search_sdk
  - Suggests using list_all_exports to see available APIs
  - Provides alternative spellings or similar API names`,
        inputSchema: GetSdkApiInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "search_sdk",
        description: `Search across all SDK code, types, and documentation.

Searches function names, class names, file paths, and code content across @pushchain/core and @pushchain/ui-kit.

Args:
  - query (required string): Search query, 2-200 characters (e.g., 'wallet', 'transaction', 'universal signer')
  - scope (optional string): Search scope - 'all' (default), 'exports', 'code', or 'types'
  - limit (optional number): Max results per category, 1-100 (default: 20)
  - offset (optional number): Pagination offset, min 0 (default: 0)

Returns:
  {
    "query": string,                    // Original search query
    "scope": string,                    // Search scope applied
    "results": {
      "exports": Array<{                // Matching exported APIs
        "name": string,
        "exportType": string,           // "functions", "classes", "types", "interfaces"
        "file": string,
        "package": string
      }>,
      "files": Array<{                  // Files with matching paths
        "path": string,
        "reason": string
      }>,
      "codeMatches": Array<{            // Content matches with context
        "path": string,
        "matches": Array<{
          "lineNumber": number,
          "line": string,
          "context": string
        }>
      }>
    },
    "totalFound": {                     // Total matches per category
      "exports": number,
      "files": number,
      "codeMatches": number
    },
    "pagination": {                     // Pagination metadata
      "offset": number,
      "limit": number,
      "has_more": boolean,
      "next_offset"?: number
    }
  }

Examples:
  - Use when: "Find wallet-related APIs" -> {"query": "wallet", "scope": "exports"}
  - Use when: "Search for transaction code" -> {"query": "transaction", "scope": "code"}
  - Use when: "Find all signer types" -> {"query": "signer", "scope": "types"}
  - Don't use when: You know the exact API name (use get_sdk_api instead)

Error Handling:
  - Returns empty results with helpful suggestions if no matches
  - Suggests trying different search terms or broader scope
  - Recommends list_all_exports for browsing available APIs`,
        inputSchema: SearchSdkInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "get_package_info",
        description: `Get complete information about @pushchain/core or @pushchain/ui-kit package.

Returns package metadata, dependencies, export statistics, and top exported APIs.

Args:
  - package (required string): Package name - 'core' for @pushchain/core or 'ui-kit' for @pushchain/ui-kit

Returns:
  {
    "name": string,                     // Package name (e.g., "@pushchain/core")
    "version": string,                  // Package version
    "description": string,              // Package description
    "dependencies": object,             // npm dependencies
    "statistics": {
      "totalExports": number,           // Total exported APIs
      "functions": number,              // Number of functions
      "classes": number,                // Number of classes
      "types": number,                  // Number of types
      "interfaces": number              // Number of interfaces
    },
    "topExports": {                     // Sample of top exports
      "functions": Array<string>,       // Top 10 function names
      "classes": Array<string>,         // Top 10 class names
      "types": Array<string>,           // Top 10 type names
      "interfaces": Array<string>       // Top 10 interface names
    }
  }

Examples:
  - Use when: "What's in @pushchain/core?" -> {"package": "core"}
  - Use when: "Show me UI kit package info" -> {"package": "ui-kit"}
  - Don't use when: You want specific API details (use get_sdk_api instead)

Error Handling:
  - Returns error if package not found
  - Suggests valid package names: 'core' or 'ui-kit'`,
        inputSchema: GetPackageInfoInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "get_type_definition",
        description: `Get TypeScript type definition with full source code.

Retrieves complete type or interface definition including all fields, documentation, and source context.

Args:
  - name (required string): Type or interface name (e.g., 'UniversalAccount', 'SignerOptions', 'PushConfig')

Returns:
  Array<{
    "name": string,                     // Type/interface name
    "type": string,                     // "types" or "interfaces"
    "package": string,                  // Package containing this type
    "file": string,                     // Source file path
    "definition": string,               // Complete type definition
    "fullSource": string                // Full file source code
  }>

Examples:
  - Use when: "What fields does UniversalAccount have?" -> {"name": "UniversalAccount"}
  - Use when: "Show me SignerOptions type" -> {"name": "SignerOptions"}
  - Use when: "What's the structure of PushConfig?" -> {"name": "PushConfig"}
  - Don't use when: You want function or class info (use get_sdk_api instead)

Error Handling:
  - Returns error if type not found
  - Suggests using search_sdk to find similar types
  - Recommends checking spelling or trying search`,
        inputSchema: GetTypeDefinitionInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "get_source_file",
        description: `Get complete source code of any file from @pushchain/core or @pushchain/ui-kit.

Returns the full TypeScript/JavaScript source code with syntax highlighting.

Args:
  - path (required string): File path starting with 'packages/core/' or 'packages/ui-kit/' (e.g., 'packages/core/src/lib/push-client/push-client.ts')

Returns:
  Markdown-formatted code block with complete file contents:
  # [file path]

  \`\`\`typescript
  [complete source code]
  \`\`\`

Examples:
  - Use when: "Show me the complete PushClient source" -> Find path first with get_sdk_api, then use that path
  - Use when: "Read the full wallet implementation" -> {"path": "packages/core/src/lib/wallet/wallet.ts"}
  - Don't use when: You only need API signature (use get_sdk_api instead)

Error Handling:
  - Returns error if file not found in core or ui-kit packages
  - Suggests verifying path starts with 'packages/core/' or 'packages/ui-kit/'
  - Response enforces CHARACTER_LIMIT and truncates with guidance if needed`,
        inputSchema: GetSourceFileInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "list_all_exports",
        description: `List all exported APIs from @pushchain/core or @pushchain/ui-kit, organized by type.

Provides a comprehensive catalog of all available functions, classes, types, and interfaces.

Args:
  - package (required string): Package to list - 'core', 'ui-kit', or 'both'
  - type (optional string): Filter by export type - 'all' (default), 'functions', 'classes', 'types', or 'interfaces'

Returns:
  {
    "functions": Array<{                // If type is 'all' or 'functions'
      "name": string,
      "package": string,                // "@pushchain/core" or "@pushchain/ui-kit"
      "file": string
    }>,
    "classes": Array<{...}>,            // If type is 'all' or 'classes'
    "types": Array<{...}>,              // If type is 'all' or 'types'
    "interfaces": Array<{...}>          // If type is 'all' or 'interfaces'
  }

Examples:
  - Use when: "What functions are in @pushchain/core?" -> {"package": "core", "type": "functions"}
  - Use when: "Show all UI kit components" -> {"package": "ui-kit", "type": "all"}
  - Use when: "List all types from both packages" -> {"package": "both", "type": "types"}
  - Don't use when: You're searching for specific APIs (use search_sdk instead)

Error Handling:
  - Returns empty arrays if no exports match the filter
  - Large result sets are truncated with guidance to use filters`,
        inputSchema: ListAllExportsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "find_usage_examples",
        description: `Find real usage examples of an API across the codebase.

Shows how functions, classes, and types are actually used in the Push Chain SDK source code.

Args:
  - api_name (required string): API name to find examples for (e.g., 'PushClient', 'createUniversalSigner')
  - limit (optional number): Max examples to return, 1-50 (default: 20)

Returns:
  {
    "api": string,                      // API name searched
    "totalExamples": number,            // Total usage examples found
    "examples": Array<{
      "file": string,                   // File containing usage
      "lineNumber": number,             // Line number of usage
      "line": string,                   // The line with usage
      "context": string                 // Surrounding code context (7 lines)
    }>
  }

Examples:
  - Use when: "How is PushClient used?" -> {"api_name": "PushClient"}
  - Use when: "Show examples of createUniversalSigner" -> {"api_name": "createUniversalSigner", "limit": 10}
  - Use when: "Find UniversalAccount usage" -> {"api_name": "UniversalAccount"}
  - Don't use when: You want the API definition (use get_sdk_api instead)

Error Handling:
  - Returns empty examples array if API not used in source
  - Suggests checking if the API name is correct
  - Excludes comment-only matches`,
        inputSchema: FindUsageExamplesInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "get_core_classes",
        description: `Get all main classes from @pushchain/core with their methods and purposes.

Returns comprehensive information about core SDK classes like PushClient, PushChain, Orchestrator, etc.

Args:
  - None required

Returns:
  {
    "totalClasses": number,             // Total classes in @pushchain/core
    "classes": Array<{
      "name": string,                   // Class name
      "file": string,                   // Source file path
      "methods": Array<string>,         // List of method names
      "signature": string,              // Class signature (first ~800 chars)
      "methodCount": number,            // Number of methods
      "note": string                    // How to get more details
    }>,
    "note": string                      // Guidance for detailed info
  }

Examples:
  - Use when: "What classes are in @pushchain/core?" -> No parameters
  - Use when: "Show me the main SDK classes" -> No parameters
  - Use when: "List all core classes with their methods" -> No parameters
  - Don't use when: You want detailed implementation (use get_sdk_api with specific class name)

Error Handling:
  - Always succeeds with available data
  - Returns empty array if no classes found`,
        inputSchema: GetCoreClassesInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      {
        name: "get_ui_components",
        description: `Get all React components and hooks from @pushchain/ui-kit with their props and usage.

Returns information about UI components, hooks, and providers available in the UI kit.

Args:
  - None required

Returns:
  {
    "summary": {
      "totalComponents": number,        // Number of components
      "totalHooks": number,             // Number of React hooks
      "totalProviders": number          // Number of providers
    },
    "components": Array<{               // React components
      "name": string,
      "file": string,
      "signature": string               // Component signature (first ~500 chars)
    }>,
    "hooks": Array<{                    // React hooks (use*)
      "name": string,
      "file": string,
      "signature": string
    }>,
    "providers": Array<{                // Context providers
      "name": string,
      "file": string,
      "signature": string
    }>,
    "note": string                      // How to get detailed info
  }

Examples:
  - Use when: "What components are in the UI kit?" -> No parameters
  - Use when: "Show me all React hooks" -> No parameters
  - Use when: "List UI kit providers" -> No parameters
  - Don't use when: You want detailed component API (use get_sdk_api with component name)

Error Handling:
  - Always succeeds with available data
  - Returns empty arrays if no components found`,
        inputSchema: GetUIComponentsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
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
    // Validate inputs and execute tool logic
    let params;

    switch (name) {
      case "get_sdk_api": {
        try {
          params = GetSdkApiInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const exports = findExport(params.name, params.package === "any" ? null : params.package);

          if (exports.length === 0) {
            return createErrorResponse(
              `API "${params.name}" not found in @pushchain/core or @pushchain/ui-kit.\n\nTry:\n- Check spelling and try again\n- Use 'search_sdk' tool to find similar names\n- Use 'list_all_exports' to see available APIs`
            );
          }

          const results = [];
          for (const exp of exports) {
            const sourceCode = coreAndUIKitFiles[exp.file] || "";
            const pkg = exp.file.includes("/core/") ? "@pushchain/core" : "@pushchain/ui-kit";

            // Extract relevant definition
            let definition = "";

            if (exp.exportType === "classes") {
              const classPattern = new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|$))`, 'm');
              const match = sourceCode.match(classPattern);
              if (match) {
                definition = match[0].length > 5000
                  ? match[0].substring(0, 5000) + "\n  // ... (truncated for brevity)\n}"
                  : match[0];
              }
            } else if (exp.exportType === "functions") {
              const funcPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|const|let|var|function|class|type|interface|$))`, 'm');
              const match = sourceCode.match(funcPattern);
              if (match) {
                definition = match[0].length > 3000
                  ? match[0].substring(0, 3000) + "\n  // ... (truncated)\n}"
                  : match[0];
              }
            } else if (exp.exportType === "types" || exp.exportType === "interfaces") {
              const typePattern = new RegExp(`export\\s+(?:type|interface)\\s+${params.name}[\\s\\S]*?(?=\\n(?:export|const|let|var|function|class|type|interface|$))`, 'm');
              const match = sourceCode.match(typePattern);
              if (match) {
                definition = match[0];
              }
            }

            if (!definition) {
              const lines = sourceCode.split('\n');
              const exportLineIndex = lines.findIndex(line =>
                line.includes(`export`) && line.includes(params.name)
              );
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
              definition: definition || "// Definition extraction failed. Use get_source_file to view complete file.",
              note: "Use get_source_file tool with the file path to see the complete source code"
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
        try {
          params = SearchSdkInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const results = searchInCode(params.query, params.scope || "all", params.limit, params.offset);

          // Apply pagination
          const exportsTruncated = truncateArray(results.exports, params.limit, "export matches");
          const filesTruncated = truncateArray(results.files, params.limit, "file matches");
          const codeTruncated = truncateArray(results.codeMatches, params.limit, "code matches");

          const summary = {
            query: params.query,
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
        try {
          params = GetPackageInfoInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const pkg = getPackageByName(params.package);

          if (!pkg) {
            return createErrorResponse(
              `Package "${params.package}" not found.\n\nValid package names: 'core' or 'ui-kit'`
            );
          }

          // Count exports by package
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
        try {
          params = GetTypeDefinitionInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const types = [...coreAndUIKitExports.types, ...coreAndUIKitExports.interfaces]
            .filter(t => t.name === params.name);

          if (types.length === 0) {
            return createErrorResponse(
              `Type "${params.name}" not found.\n\nTry:\n- Use 'search_sdk' to find similar type names\n- Use 'list_all_exports' with type='types' to see all available types`
            );
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
        try {
          params = GetSourceFileInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const sourceCode = coreAndUIKitFiles[params.path];

          if (!sourceCode) {
            return createErrorResponse(
              `File "${params.path}" not found in @pushchain/core or @pushchain/ui-kit.\n\nEnsure path starts with 'packages/core/' or 'packages/ui-kit/'`
            );
          }

          const response = `# ${params.path}\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``;
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_source_file"));
        }
      }

      case "list_all_exports": {
        try {
          params = ListAllExportsInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          let packageFilter = null;
          if (params.package !== "both") {
            packageFilter = params.package;
          }

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
        try {
          params = FindUsageExamplesInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

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
            examples: truncated.items,
            ...(truncated.truncated ? { message: truncated.message } : {})
          };

          const response = JSON.stringify(result, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleSdkError(error, "find_usage_examples"));
        }
      }

      case "get_core_classes": {
        try {
          params = GetCoreClassesInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

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
                note: "Use get_sdk_api with the class name to see more details, or get_source_file for complete code"
              };
            });

          const result = {
            totalClasses: coreClasses.length,
            classes: coreClasses,
            note: "This is a summary. Use get_sdk_api(name: 'ClassName') for detailed class info."
          };

          const response = JSON.stringify(result, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_core_classes"));
        }
      }

      case "get_ui_components": {
        try {
          params = GetUIComponentsInputSchema.parse(args);
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(handleValidationError(error));
          }
          throw error;
        }

        try {
          const uiExports = {
            components: [],
            hooks: [],
            providers: []
          };

          for (const func of coreAndUIKitExports.functions) {
            if (func.file.includes("packages/ui-kit/")) {
              const sourceCode = coreAndUIKitFiles[func.file] || "";

              const funcPattern = new RegExp(`export\\s+(?:const\\s+)?${func.name}[\\s\\S]{0,500}`, 'm');
              const match = sourceCode.match(funcPattern);
              const signature = match ? match[0] + "..." : "";

              if (func.name.startsWith("use")) {
                uiExports.hooks.push({
                  name: func.name,
                  file: func.file,
                  signature: signature
                });
              } else if (func.name.includes("Provider")) {
                uiExports.providers.push({
                  name: func.name,
                  file: func.file,
                  signature: signature
                });
              } else {
                uiExports.components.push({
                  name: func.name,
                  file: func.file,
                  signature: signature
                });
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
            note: "Use get_sdk_api(name: 'ComponentName') for detailed information, or get_source_file for complete code"
          };

          const response = JSON.stringify(result, null, 2);
          const limited = enforceCharacterLimit(response);
          return createSuccessResponse(limited.text);

        } catch (error) {
          return createErrorResponse(handleSdkError(error, "get_ui_components"));
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
 * List resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  for (const path of Object.keys(coreAndUIKitFiles)) {
    const pkg = path.includes("/core/") ? "core" : "ui-kit";
    resources.push({
      uri: `pushchain://${pkg}/${path}`,
      name: path.split('/').pop(),
      description: `Source: ${path}`,
      mimeType: "text/typescript"
    });
  }

  return { resources };
});

/**
 * Read resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (!uri.startsWith("pushchain://")) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const path = uri.replace(/^pushchain:\/\/(?:core|ui-kit)\//, "");
  const content = coreAndUIKitFiles[path];

  if (!content) {
    throw new Error(`Resource not found: ${path}`);
  }

  return {
    contents: [{
      uri,
      mimeType: "text/typescript",
      text: content
    }]
  };
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Push Chain SDK MCP Server running on stdio");
  console.error("Ready to provide SDK access");

  if (GITHUB_TOKEN) {
    console.error("✓ GitHub token configured (authenticated requests: 5000/hour)");
  } else {
    console.error("⚠️  Note: No GitHub token set (not required for SDK server, but useful for future features)");
  }

  // Check for SDK updates in the background (non-blocking)
  if (process.env.SDK_AUTO_UPDATE !== "false") {
    console.error("\n🔄 Checking for SDK updates in background...");
    checkAndUpdate(false).catch(error => {
      console.error("Background update check failed:", error.message);
    });
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
