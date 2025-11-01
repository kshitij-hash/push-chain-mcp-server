/**
 * Response formatting utilities for Push Chain MCP Servers
 */

import { CHARACTER_LIMIT } from "./constants.js";

/**
 * Sanitizes user input to prevent injection attacks
 * Escapes special characters that could be used maliciously
 *
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return String(input);

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove null bytes
    .replace(/\0/g, '')
    // Limit consecutive special characters
    .replace(/([^\w\s])\1{3,}/g, '$1$1$1');
}

/**
 * Formats response data based on the requested format (JSON or Markdown)
 *
 * @param {any} data - The data to format
 * @param {string} format - Either "json" or "markdown"
 * @returns {string} Formatted response string
 */
export function formatResponse(data, format = "markdown") {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }

  // For markdown, data should already be formatted as markdown string
  return data;
}

/**
 * Enforces character limit on response text and truncates if necessary
 *
 * @param {string} text - The response text to check
 * @param {number} limit - Character limit (defaults to CHARACTER_LIMIT)
 * @returns {Object} Object containing text, truncated flag, and metadata
 */
export function enforceCharacterLimit(text, limit = CHARACTER_LIMIT) {
  if (text.length <= limit) {
    return {
      text,
      truncated: false,
      originalLength: text.length
    };
  }

  // Truncate to limit
  const truncated = text.substring(0, limit);
  const message = `\n\n---\n**[Response Truncated]**\nOriginal length: ${text.length} characters\nShowing: ${limit} characters\n\nTo see more results:\n- Use more specific search terms or filters\n- Use pagination parameters (limit, offset) to retrieve data in smaller chunks\n- Request specific sections or resources instead of full content`;

  return {
    text: truncated + message,
    truncated: true,
    originalLength: text.length,
    displayedLength: limit
  };
}

/**
 * Truncates an array of items intelligently and adds metadata
 *
 * @param {Array} items - Array of items to potentially truncate
 * @param {number} maxItems - Maximum number of items to include
 * @param {string} itemType - Description of item type (for message)
 * @returns {Object} Object with truncated items and metadata
 */
export function truncateArray(items, maxItems, itemType = "items") {
  if (items.length <= maxItems) {
    return {
      items,
      truncated: false,
      total: items.length,
      showing: items.length
    };
  }

  return {
    items: items.slice(0, maxItems),
    truncated: true,
    total: items.length,
    showing: maxItems,
    message: `Showing ${maxItems} of ${items.length} ${itemType}. Use pagination or filters to see more.`
  };
}

/**
 * Formats pagination metadata for consistent responses
 *
 * @param {number} total - Total number of items available
 * @param {number} offset - Current offset
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
export function formatPaginationMetadata(total, offset, limit) {
  const hasMore = (offset + limit) < total;
  const showing = Math.min(limit, total - offset);

  return {
    total,
    offset,
    limit,
    showing,
    has_more: hasMore,
    ...(hasMore ? { next_offset: offset + limit } : {})
  };
}

/**
 * Formats pagination text for markdown responses
 *
 * @param {number} total - Total number of items available
 * @param {number} offset - Current offset
 * @param {number} limit - Items per page
 * @param {number} showing - Actual items shown
 * @returns {string} Formatted pagination text
 */
export function formatPaginationText(total, offset = 0, limit = 20, showing = null) {
  const actualShowing = showing !== null ? showing : Math.min(limit, total - offset);
  const start = offset + 1;
  const end = offset + actualShowing;
  const hasMore = end < total;

  let text = `\n\n---\n📊 **Pagination**\n`;
  text += `Showing ${actualShowing} results (${start}-${end} of ${total} total)\n`;

  if (hasMore) {
    text += `\n💡 To see more results, use:\n`;
    text += `- \`limit\`: Number of results per page (currently: ${limit})\n`;
    text += `- \`offset\`: Skip first N results (currently: ${offset}, next: ${offset + limit})\n`;
  }

  return text;
}
