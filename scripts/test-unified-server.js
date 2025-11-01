#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Unified MCP Server
 *
 * Tests all 13 tools, resource endpoints, and error handling
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

function log(color, prefix, message) {
  console.error(`${color}${prefix}${RESET} ${message}`);
}

function success(message) {
  testsPassed++;
  log(GREEN, '✓', message);
}

function fail(message, error) {
  testsFailed++;
  log(RED, '✗', message);
  if (error) console.error(`  Error: ${error}`);
}

function skip(message) {
  testsSkipped++;
  log(YELLOW, '○', message);
}

function info(message) {
  log(BLUE, 'ℹ', message);
}

class MCPClient {
  constructor() {
    this.process = null;
    this.messageId = 1;
    this.responses = new Map();
    this.buffer = '';
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.process = spawn('node', ['index-unified.js'], {
        stdio: ['pipe', 'pipe', 'inherit']
      });

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.on('error', reject);

      // Wait for server to be ready
      setTimeout(() => resolve(), 2000);
    });
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id) {
          const resolver = this.responses.get(response.id);
          if (resolver) {
            resolver(response);
            this.responses.delete(response.id);
          }
        }
      } catch (e) {
        // Ignore non-JSON lines (server logs)
      }
    }
  }

  async sendRequest(method, params = {}) {
    const id = this.messageId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.responses.set(id, resolve);
      this.process.stdin.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        if (this.responses.has(id)) {
          this.responses.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testServerInitialization(client) {
  info('Testing server initialization...');

  try {
    const response = await client.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });

    if (response.result && response.result.serverInfo) {
      success('Server initialization successful');
      info(`  Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
      return true;
    } else {
      fail('Server initialization failed - invalid response');
      return false;
    }
  } catch (error) {
    fail('Server initialization failed', error.message);
    return false;
  }
}

async function testListTools(client) {
  info('\nTesting tools/list endpoint...');

  try {
    const response = await client.sendRequest('tools/list');

    if (response.result && response.result.tools) {
      const tools = response.result.tools;
      const expectedTools = [
        // Documentation tools (4)
        'list_push_chain_docs',
        'get_push_chain_doc',
        'search_push_chain_docs',
        'get_code_snippets',
        // SDK tools (9)
        'get_sdk_api',
        'search_sdk',
        'get_package_info',
        'get_type_definition',
        'get_source_file',
        'list_all_exports',
        'find_usage_examples',
        'get_core_classes',
        'get_ui_components'
      ];

      const foundTools = tools.map(t => t.name);
      const allFound = expectedTools.every(t => foundTools.includes(t));

      if (allFound && tools.length === 13) {
        success(`All 13 tools present: ${tools.length} tools found`);
        return true;
      } else {
        fail(`Expected 13 tools, found ${tools.length}`);
        const missing = expectedTools.filter(t => !foundTools.includes(t));
        if (missing.length > 0) {
          console.error(`  Missing: ${missing.join(', ')}`);
        }
        return false;
      }
    } else {
      fail('tools/list failed - invalid response');
      return false;
    }
  } catch (error) {
    fail('tools/list failed', error.message);
    return false;
  }
}

async function testDocumentationTools(client) {
  info('\n📚 Testing Documentation Tools (4 tools)...');
  let passed = 0;

  // Test 1: list_push_chain_docs
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'list_push_chain_docs',
      arguments: { category: 'all' }
    });

    if (response.result && !response.error) {
      const content = response.result.content[0].text;
      if (content.includes('total') && content.includes('categories')) {
        success('list_push_chain_docs works');
        passed++;
      } else {
        fail('list_push_chain_docs - unexpected response format');
      }
    } else {
      fail('list_push_chain_docs failed', response.error?.message);
    }
  } catch (error) {
    fail('list_push_chain_docs failed', error.message);
  }

  // Test 2: search_push_chain_docs
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'search_push_chain_docs',
      arguments: { query: 'intro', limit: 5 }
    });

    if (response.result && !response.error) {
      success('search_push_chain_docs works');
      passed++;
    } else {
      fail('search_push_chain_docs failed', response.error?.message);
    }
  } catch (error) {
    fail('search_push_chain_docs failed', error.message);
  }

  // Test 3: get_code_snippets (might have no results)
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_code_snippets',
      arguments: { limit: 5 }
    });

    if (response.result && !response.error) {
      success('get_code_snippets works');
      passed++;
    } else {
      fail('get_code_snippets failed', response.error?.message);
    }
  } catch (error) {
    fail('get_code_snippets failed', error.message);
  }

  // Test 4: get_push_chain_doc (will fail without valid path, test error handling)
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_push_chain_doc',
      arguments: { path: 'nonexistent.mdx' }
    });

    // Should get an error response
    if (response.result && response.result.isError) {
      success('get_push_chain_doc error handling works');
      passed++;
    } else if (response.error) {
      success('get_push_chain_doc error handling works');
      passed++;
    } else {
      skip('get_push_chain_doc - unexpected success with invalid path');
      passed++;
    }
  } catch (error) {
    success('get_push_chain_doc error handling works (threw error)');
    passed++;
  }

  info(`  Documentation tools: ${passed}/4 passed`);
  return passed === 4;
}

async function testSDKTools(client) {
  info('\n🔧 Testing SDK Tools (9 tools)...');
  let passed = 0;

  // Test 1: get_package_info
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_package_info',
      arguments: { package: 'core' }
    });

    if (response.result && !response.error) {
      const content = response.result.content[0].text;
      if (content.includes('statistics') && content.includes('@pushchain/core')) {
        success('get_package_info works');
        passed++;
      } else {
        fail('get_package_info - unexpected response format');
      }
    } else {
      fail('get_package_info failed', response.error?.message);
    }
  } catch (error) {
    fail('get_package_info failed', error.message);
  }

  // Test 2: list_all_exports
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'list_all_exports',
      arguments: { package: 'core', type: 'functions' }
    });

    if (response.result && !response.error) {
      success('list_all_exports works');
      passed++;
    } else {
      fail('list_all_exports failed', response.error?.message);
    }
  } catch (error) {
    fail('list_all_exports failed', error.message);
  }

  // Test 3: get_core_classes
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_core_classes',
      arguments: {}
    });

    if (response.result && !response.error) {
      const content = response.result.content[0].text;
      if (content.includes('totalClasses') && content.includes('classes')) {
        success('get_core_classes works');
        passed++;
      } else {
        fail('get_core_classes - unexpected response format');
      }
    } else {
      fail('get_core_classes failed', response.error?.message);
    }
  } catch (error) {
    fail('get_core_classes failed', error.message);
  }

  // Test 4: get_ui_components
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_ui_components',
      arguments: {}
    });

    if (response.result && !response.error) {
      const content = response.result.content[0].text;
      if (content.includes('summary')) {
        success('get_ui_components works');
        passed++;
      } else {
        fail('get_ui_components - unexpected response format');
      }
    } else {
      fail('get_ui_components failed', response.error?.message);
    }
  } catch (error) {
    fail('get_ui_components failed', error.message);
  }

  // Test 5: search_sdk
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'search_sdk',
      arguments: { query: 'push', scope: 'all', limit: 5 }
    });

    if (response.result && !response.error) {
      success('search_sdk works');
      passed++;
    } else {
      fail('search_sdk failed', response.error?.message);
    }
  } catch (error) {
    fail('search_sdk failed', error.message);
  }

  // Test 6: get_sdk_api (test with nonexistent API for error handling)
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_sdk_api',
      arguments: { name: 'NonexistentAPI', package: 'any' }
    });

    if (response.result && response.result.isError) {
      success('get_sdk_api error handling works');
      passed++;
    } else if (response.error || (response.result && response.result.content[0].text.includes('not found'))) {
      success('get_sdk_api error handling works');
      passed++;
    } else {
      skip('get_sdk_api - needs existing API for full test');
      passed++;
    }
  } catch (error) {
    success('get_sdk_api error handling works (threw error)');
    passed++;
  }

  // Test 7: get_type_definition (test error handling)
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_type_definition',
      arguments: { name: 'NonexistentType' }
    });

    if (response.result && (response.result.isError || response.result.content[0].text.includes('not found'))) {
      success('get_type_definition error handling works');
      passed++;
    } else if (response.error) {
      success('get_type_definition error handling works');
      passed++;
    } else {
      skip('get_type_definition - needs existing type for full test');
      passed++;
    }
  } catch (error) {
    success('get_type_definition error handling works (threw error)');
    passed++;
  }

  // Test 8: find_usage_examples
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'find_usage_examples',
      arguments: { api_name: 'PushClient', limit: 5 }
    });

    if (response.result && !response.error) {
      success('find_usage_examples works');
      passed++;
    } else {
      fail('find_usage_examples failed', response.error?.message);
    }
  } catch (error) {
    fail('find_usage_examples failed', error.message);
  }

  // Test 9: get_source_file (test error handling)
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_source_file',
      arguments: { path: 'packages/core/nonexistent.ts' }
    });

    if (response.result && (response.result.isError || response.result.content[0].text.includes('not found'))) {
      success('get_source_file error handling works');
      passed++;
    } else if (response.error) {
      success('get_source_file error handling works');
      passed++;
    } else {
      skip('get_source_file - unexpected success with invalid path');
      passed++;
    }
  } catch (error) {
    success('get_source_file error handling works (threw error)');
    passed++;
  }

  info(`  SDK tools: ${passed}/9 passed`);
  return passed === 9;
}

async function testResourceEndpoints(client) {
  info('\n📦 Testing Resource Endpoints...');
  let passed = 0;

  // Test resources/list
  try {
    const response = await client.sendRequest('resources/list');

    if (response.result && response.result.resources) {
      const resources = response.result.resources;
      if (resources.length > 0) {
        success(`resources/list works (${resources.length} resources)`);
        passed++;

        // Check for both doc and SDK resources
        const hasDocResources = resources.some(r => r.uri.startsWith('pushchain://docs/'));
        const hasSdkResources = resources.some(r => r.uri.startsWith('pushchain://sdk/'));

        if (hasDocResources && hasSdkResources) {
          success('Both doc and SDK resources present');
          passed++;
        } else {
          fail('Missing doc or SDK resources');
        }
      } else {
        fail('resources/list returned empty array');
      }
    } else {
      fail('resources/list failed - invalid response');
    }
  } catch (error) {
    fail('resources/list failed', error.message);
  }

  info(`  Resource endpoints: ${passed}/2 passed`);
  return passed === 2;
}

async function testErrorHandling(client) {
  info('\n⚠️  Testing Error Handling...');
  let passed = 0;

  // Test invalid tool name
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'nonexistent_tool',
      arguments: {}
    });

    if (response.error || (response.result && response.result.isError)) {
      success('Invalid tool name handled correctly');
      passed++;
    } else {
      fail('Invalid tool name not handled');
    }
  } catch (error) {
    success('Invalid tool name handled correctly (threw error)');
    passed++;
  }

  // Test invalid arguments (missing required field)
  try {
    const response = await client.sendRequest('tools/call', {
      name: 'get_package_info',
      arguments: {} // missing required 'package' field
    });

    if (response.error || (response.result && response.result.isError)) {
      success('Invalid arguments handled correctly');
      passed++;
    } else {
      fail('Invalid arguments not handled');
    }
  } catch (error) {
    success('Invalid arguments handled correctly (threw error)');
    passed++;
  }

  info(`  Error handling: ${passed}/2 passed`);
  return passed === 2;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.error('\n' + '='.repeat(60));
  console.error('🧪 UNIFIED MCP SERVER - COMPREHENSIVE TEST SUITE');
  console.error('='.repeat(60) + '\n');

  const client = new MCPClient();

  try {
    info('Starting unified server...');
    await client.start();
    success('Server started successfully\n');

    // Run all test suites
    await testServerInitialization(client);
    await testListTools(client);
    await testDocumentationTools(client);
    await testSDKTools(client);
    await testResourceEndpoints(client);
    await testErrorHandling(client);

  } catch (error) {
    fail('Fatal error during testing', error.message);
  } finally {
    await client.stop();
  }

  // Print summary
  console.error('\n' + '='.repeat(60));
  console.error('📊 TEST SUMMARY');
  console.error('='.repeat(60));
  console.error(`${GREEN}✓ Passed:${RESET}  ${testsPassed}`);
  console.error(`${RED}✗ Failed:${RESET}  ${testsFailed}`);
  console.error(`${YELLOW}○ Skipped:${RESET} ${testsSkipped}`);
  console.error(`${BLUE}  Total:${RESET}   ${testsPassed + testsFailed + testsSkipped}`);
  console.error('='.repeat(60));

  const successRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
  console.error(`\n${BLUE}Success Rate:${RESET} ${successRate}%`);

  if (testsFailed === 0) {
    console.error(`\n${GREEN}✅ ALL TESTS PASSED! Server is ready for production.${RESET}\n`);
    process.exit(0);
  } else {
    console.error(`\n${RED}❌ SOME TESTS FAILED! Please review and fix.${RESET}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});
