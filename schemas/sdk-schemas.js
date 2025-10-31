/**
 * Zod validation schemas for Push Chain SDK MCP Server
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
 * Schema for get_sdk_api tool
 * Gets detailed information about any exported API from @pushchain/core or @pushchain/ui-kit
 */
export const GetSdkApiInputSchema = z.object({
  name: z.string()
    .min(1, "API name is required")
    .max(200, "API name must not exceed 200 characters")
    .describe("Name of the API (e.g., 'PushClient', 'createUniversalSigner', 'UniversalAccount')"),
  package: z.enum(["core", "ui-kit", "any"])
    .default("any")
    .describe("Optional: Package to search in. Use 'core' for @pushchain/core, 'ui-kit' for @pushchain/ui-kit, or 'any' to search both")
}).strict();

/**
 * Schema for search_sdk tool
 * Searches across all SDK code, types, and documentation
 */
export const SearchSdkInputSchema = z.object({
  query: z.string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search query to match against function names, class names, file paths, and code content (e.g., 'wallet', 'transaction', 'universal signer')"),
  scope: z.enum(["all", "exports", "code", "types"])
    .default("all")
    .describe("Search scope: 'all' for everything, 'exports' for exported APIs only, 'code' for file content, 'types' for type definitions"),
  limit: z.number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20)
    .describe("Maximum number of results to return per category (default: 20)"),
  offset: z.number()
    .int()
    .min(0, "Offset cannot be negative")
    .default(0)
    .describe("Number of results to skip for pagination (default: 0)")
}).strict();

/**
 * Schema for get_package_info tool
 * Gets complete information about a Push Chain package
 */
export const GetPackageInfoInputSchema = z.object({
  package: z.enum(["core", "ui-kit"])
    .describe("Package name: 'core' for @pushchain/core or 'ui-kit' for @pushchain/ui-kit")
}).strict();

/**
 * Schema for get_type_definition tool
 * Gets TypeScript type definition with full source code
 */
export const GetTypeDefinitionInputSchema = z.object({
  name: z.string()
    .min(1, "Type name is required")
    .max(200, "Type name must not exceed 200 characters")
    .describe("Type or interface name (e.g., 'UniversalAccount', 'SignerOptions', 'PushConfig')")
}).strict();

/**
 * Schema for get_source_file tool
 * Gets complete source code of any file from the SDK
 */
export const GetSourceFileInputSchema = z.object({
  path: z.string()
    .min(1, "File path is required")
    .max(500, "File path must not exceed 500 characters")
    .regex(/^packages\/(core|ui-kit)\//, "Path must start with 'packages/core/' or 'packages/ui-kit/'")
    .describe("File path (e.g., 'packages/core/src/lib/push-client/push-client.ts')")
}).strict();

/**
 * Schema for list_all_exports tool
 * Lists all exported APIs from specified packages
 */
export const ListAllExportsInputSchema = z.object({
  package: z.enum(["core", "ui-kit", "both"])
    .describe("Package to list exports from: 'core', 'ui-kit', or 'both'"),
  type: z.enum(["all", "functions", "classes", "types", "interfaces"])
    .default("all")
    .describe("Filter by export type: 'all', 'functions', 'classes', 'types', or 'interfaces'")
}).strict();

/**
 * Schema for find_usage_examples tool
 * Finds real usage examples of an API across the codebase
 */
export const FindUsageExamplesInputSchema = z.object({
  api_name: z.string()
    .min(1, "API name is required")
    .max(200, "API name must not exceed 200 characters")
    .describe("API name to find usage examples for (e.g., 'PushClient', 'createUniversalSigner')"),
  limit: z.number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(20)
    .describe("Maximum number of usage examples to return (default: 20)")
}).strict();

/**
 * Schema for get_core_classes tool
 * Gets all main classes from @pushchain/core with their methods
 */
export const GetCoreClassesInputSchema = z.object({
  // No parameters needed
}).strict();

/**
 * Schema for get_ui_components tool
 * Gets all React components and hooks from @pushchain/ui-kit
 */
export const GetUIComponentsInputSchema = z.object({
  // No parameters needed
}).strict();
