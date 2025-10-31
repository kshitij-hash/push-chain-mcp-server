/**
 * Error handling utilities for Push Chain MCP Servers
 * Provides clear, actionable error messages for common failure scenarios
 */

/**
 * Handles GitHub API errors with specific, actionable messages
 *
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message with guidance
 */
export function handleGitHubApiError(error) {
  // Handle fetch/network errors
  if (error.code === "ENOTFOUND") {
    return "Error: Cannot reach GitHub API. Please check your network connection and try again.";
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "Error: Request to GitHub timed out. GitHub may be experiencing issues. Please retry in a few moments.";
  }

  // Handle HTTP response errors
  if (error.response) {
    const status = error.response.status;

    switch (status) {
      case 404:
        return "Error: Documentation file not found on GitHub. Use the 'list_push_chain_docs' tool to see all available documentation files.";

      case 403:
        return "Error: GitHub API rate limit exceeded. This server uses 30-minute caching to minimize requests. Please wait approximately 1 hour for the rate limit to reset, or try again later.";

      case 422:
        return "Error: Invalid request to GitHub API. Please check that the file path is correctly formatted (e.g., 'docs/chain/filename.mdx').";

      case 500:
      case 502:
      case 503:
        return "Error: GitHub is experiencing server issues (status " + status + "). Please try again in a few minutes.";

      default:
        return `Error: GitHub API request failed with status ${status}. Please try again later.`;
    }
  }

  // Generic error fallback
  const message = error.message || String(error);
  return `Error: An unexpected error occurred: ${message}`;
}

/**
 * Handles validation errors from Zod schemas
 *
 * @param {import('zod').ZodError} error - The Zod validation error
 * @returns {string} Formatted validation error message
 */
export function handleValidationError(error) {
  if (error.errors && error.errors.length > 0) {
    const issues = error.errors.map(err => {
      const path = err.path.join(".");
      return `  - ${path}: ${err.message}`;
    }).join("\n");

    return `Error: Invalid input parameters:\n${issues}\n\nPlease check the parameter types and constraints, then try again.`;
  }

  return "Error: Invalid input parameters. Please check your input and try again.";
}

/**
 * Handles SDK data access errors
 *
 * @param {Error} error - The error object
 * @param {string} context - Context about what operation failed
 * @returns {string} User-friendly error message
 */
export function handleSdkError(error, context = "SDK operation") {
  const message = error.message || String(error);

  if (message.includes("not found")) {
    return `Error: ${context} - Resource not found. Please verify the name or path is correct and try again.`;
  }

  if (message.includes("ENOENT") || message.includes("file")) {
    return `Error: ${context} - Required SDK data files are missing or corrupted. Please ensure all JSON data files are present and readable.`;
  }

  if (message.includes("JSON") || message.includes("parse")) {
    return `Error: ${context} - SDK data file is corrupted or invalid. Please verify data file integrity.`;
  }

  return `Error: ${context} failed - ${message}`;
}

/**
 * Creates a standardized error response for MCP tools
 *
 * @param {string} errorMessage - The error message to return
 * @param {boolean} isError - Whether to mark as error (default: true)
 * @returns {Object} MCP tool error response
 */
export function createErrorResponse(errorMessage, isError = true) {
  return {
    content: [{
      type: "text",
      text: errorMessage
    }],
    isError
  };
}

/**
 * Creates a standardized success response for MCP tools
 *
 * @param {string} text - The response text
 * @returns {Object} MCP tool success response
 */
export function createSuccessResponse(text) {
  return {
    content: [{
      type: "text",
      text
    }]
  };
}
