/**
 * Schema conversion utilities
 * Converts Zod schemas to MCP-compatible JSON Schema with explicit type field
 */

import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Converts a Zod schema to JSON Schema with explicit type field
 * Ensures MCP compliance by adding type: "object" at root level
 *
 * @param {import('zod').ZodSchema} zodSchema - Zod schema to convert
 * @param {string} name - Schema name for reference
 * @returns {Object} JSON Schema with type field
 */
export function zodToMcpSchema(zodSchema, name = 'Schema') {
  const jsonSchema = zodToJsonSchema(zodSchema, {
    name,
    $refStrategy: 'none',
    target: 'jsonSchema7'
  });

  // Ensure root level has type: "object"
  if (!jsonSchema.type) {
    jsonSchema.type = 'object';
  }

  // Ensure properties field exists for MCP compliance
  if (!jsonSchema.properties) {
    jsonSchema.properties = {};
  }

  // Remove $schema field if present (MCP doesn't need it)
  delete jsonSchema.$schema;

  return jsonSchema;
}
