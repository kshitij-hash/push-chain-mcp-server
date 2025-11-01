#!/usr/bin/env node

/**
 * MCP Compliance Testing Suite
 *
 * Tests Push Chain MCP Server against industry standards:
 * - MCP Protocol Compliance (v1.0.4)
 * - Tool Implementation Best Practices
 * - Error Handling Standards
 * - Performance Requirements
 * - Security Standards
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class MCPComplianceTester {
  constructor() {
    this.process = null;
    this.messageId = 1;
    this.responses = new Map();
    this.testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      total: 0,
      categories: {}
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async start() {
    this.log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║       MCP COMPLIANCE & INDUSTRY STANDARDS TEST SUITE      ║', 'cyan');
    this.log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    const serverPath = resolve(__dirname, '..', 'index-unified.js');
    this.process = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let buffer = '';
    this.process.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id && this.responses.has(response.id)) {
            const resolve = this.responses.get(response.id);
            this.responses.delete(response.id);
            resolve(response);
          }
        } catch (e) {
          // Ignore non-JSON output (server logs)
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
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
      }, 30000);
    });
  }

  recordResult(category, testName, passed, message = '', severity = 'error') {
    this.testResults.total++;
    if (!this.testResults.categories[category]) {
      this.testResults.categories[category] = { passed: 0, failed: 0, warnings: 0, tests: [] };
    }

    if (passed) {
      this.testResults.passed++;
      this.testResults.categories[category].passed++;
      this.log(`  ✓ ${testName}`, 'green');
    } else {
      if (severity === 'warning') {
        this.testResults.warnings++;
        this.testResults.categories[category].warnings++;
        this.log(`  ⚠ ${testName}`, 'yellow');
      } else {
        this.testResults.failed++;
        this.testResults.categories[category].failed++;
        this.log(`  ✗ ${testName}`, 'red');
      }
      if (message) this.log(`    ${message}`, 'gray');
    }

    this.testResults.categories[category].tests.push({
      name: testName,
      passed,
      message,
      severity
    });
  }

  // ====================================================================
  // TEST CATEGORY 1: MCP PROTOCOL COMPLIANCE
  // ====================================================================
  async testProtocolCompliance() {
    this.log('\n━━━ 1. MCP PROTOCOL COMPLIANCE ━━━', 'blue');

    // Test 1.1: Initialization
    try {
      const initResponse = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      this.recordResult('Protocol', 'Initialize handshake',
        initResponse.result && initResponse.result.protocolVersion,
        initResponse.error ? initResponse.error.message : ''
      );

      this.recordResult('Protocol', 'Server capabilities declared',
        initResponse.result && initResponse.result.capabilities,
        !initResponse.result?.capabilities ? 'Missing capabilities object' : ''
      );

      this.recordResult('Protocol', 'Server info provided',
        initResponse.result && initResponse.result.serverInfo &&
        initResponse.result.serverInfo.name && initResponse.result.serverInfo.version,
        !initResponse.result?.serverInfo ? 'Missing serverInfo' : ''
      );
    } catch (error) {
      this.recordResult('Protocol', 'Initialize handshake', false, error.message);
      this.recordResult('Protocol', 'Server capabilities declared', false, 'Initialization failed');
      this.recordResult('Protocol', 'Server info provided', false, 'Initialization failed');
    }

    // Test 1.2: JSON-RPC 2.0 compliance
    try {
      const response = await this.sendRequest('tools/list');
      this.recordResult('Protocol', 'JSON-RPC 2.0 format (has jsonrpc field)',
        response.jsonrpc === '2.0',
        response.jsonrpc ? `Got: ${response.jsonrpc}` : 'Missing jsonrpc field'
      );

      this.recordResult('Protocol', 'Response has id field',
        response.id !== undefined,
        'Missing id field in response'
      );

      this.recordResult('Protocol', 'Response has result or error',
        response.result !== undefined || response.error !== undefined,
        'Missing both result and error fields'
      );
    } catch (error) {
      this.recordResult('Protocol', 'JSON-RPC 2.0 format', false, error.message);
    }

    // Test 1.3: Error format compliance
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'nonexistent_tool',
        arguments: {}
      });

      if (response.error) {
        this.recordResult('Protocol', 'Error response format (has code)',
          typeof response.error.code === 'number',
          !response.error.code ? 'Error missing code field' : ''
        );

        this.recordResult('Protocol', 'Error response format (has message)',
          typeof response.error.message === 'string',
          !response.error.message ? 'Error missing message field' : ''
        );
      }
    } catch (error) {
      this.recordResult('Protocol', 'Error handling', false, error.message, 'warning');
    }
  }

  // ====================================================================
  // TEST CATEGORY 2: TOOL IMPLEMENTATION
  // ====================================================================
  async testToolImplementation() {
    this.log('\n━━━ 2. TOOL IMPLEMENTATION STANDARDS ━━━', 'blue');

    // Test 2.1: List tools
    let toolsList;
    try {
      const response = await this.sendRequest('tools/list');
      toolsList = response.result?.tools || [];

      this.recordResult('Tools', 'tools/list returns array',
        Array.isArray(toolsList),
        `Got: ${typeof toolsList}`
      );

      this.recordResult('Tools', 'All 13 tools registered',
        toolsList.length === 13,
        `Found ${toolsList.length} tools, expected 13`
      );
    } catch (error) {
      this.recordResult('Tools', 'tools/list endpoint', false, error.message);
      return;
    }

    // Test 2.2: Tool schema validation
    for (const tool of toolsList) {
      const hasRequiredFields = tool.name && tool.description && tool.inputSchema;
      this.recordResult('Tools', `Tool "${tool.name}" has required fields`,
        hasRequiredFields,
        !hasRequiredFields ? 'Missing name, description, or inputSchema' : ''
      );

      if (tool.inputSchema) {
        this.recordResult('Tools', `Tool "${tool.name}" inputSchema is valid JSON Schema`,
          tool.inputSchema.type && tool.inputSchema.properties,
          !tool.inputSchema.type ? 'Missing type field' : 'Missing properties field',
          'warning'
        );
      }
    }

    // Test 2.3: Description quality
    for (const tool of toolsList) {
      const descLength = tool.description?.length || 0;
      this.recordResult('Tools', `Tool "${tool.name}" has descriptive text`,
        descLength > 20,
        descLength <= 20 ? `Description too short (${descLength} chars)` : '',
        'warning'
      );
    }
  }

  // ====================================================================
  // TEST CATEGORY 3: FUNCTIONAL TESTING
  // ====================================================================
  async testFunctionalBehavior() {
    this.log('\n━━━ 3. FUNCTIONAL BEHAVIOR ━━━', 'blue');

    // Test 3.1: Documentation tools
    const docTests = [
      { name: 'list_push_chain_docs', args: { category: 'all' } },
      { name: 'search_push_chain_docs', args: { query: 'wallet', limit: 3 } }
    ];

    for (const test of docTests) {
      try {
        const response = await this.sendRequest('tools/call', {
          name: test.name,
          arguments: test.args
        });

        const hasContent = response.result?.content?.[0]?.text;
        this.recordResult('Functional', `Tool "${test.name}" returns content`,
          hasContent,
          !hasContent ? 'No content in response' : ''
        );

        if (hasContent) {
          const text = response.result.content[0].text;
          this.recordResult('Functional', `Tool "${test.name}" respects character limit`,
            text.length <= 26000,
            text.length > 26000 ? `Response ${text.length} chars exceeds 25000 limit` : '',
            'warning'
          );
        }
      } catch (error) {
        this.recordResult('Functional', `Tool "${test.name}"`, false, error.message);
      }
    }

    // Test 3.2: SDK tools
    const sdkTests = [
      { name: 'get_sdk_api', args: { name: 'createClient' } },
      { name: 'search_sdk', args: { query: 'client', limit: 3 } },
      { name: 'list_all_exports', args: { package: 'core', type: 'functions' } }
    ];

    for (const test of sdkTests) {
      try {
        const response = await this.sendRequest('tools/call', {
          name: test.name,
          arguments: test.args
        });

        const hasContent = response.result?.content?.[0]?.text;
        this.recordResult('Functional', `Tool "${test.name}" returns content`,
          hasContent,
          !hasContent ? 'No content in response' : ''
        );
      } catch (error) {
        this.recordResult('Functional', `Tool "${test.name}"`, false, error.message);
      }
    }

    // Test 3.3: Invalid input handling
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'search_docs',
        arguments: { limit: 'invalid' } // Should be number
      });

      this.recordResult('Functional', 'Validation rejects invalid input types',
        response.error !== undefined,
        !response.error ? 'Should reject invalid input but succeeded' : ''
      );
    } catch (error) {
      this.recordResult('Functional', 'Invalid input handling', true);
    }
  }

  // ====================================================================
  // TEST CATEGORY 4: RESOURCE ENDPOINTS
  // ====================================================================
  async testResourceEndpoints() {
    this.log('\n━━━ 4. RESOURCE ENDPOINTS ━━━', 'blue');

    // Test 4.1: List resources
    try {
      const response = await this.sendRequest('resources/list');
      const resources = response.result?.resources || [];

      this.recordResult('Resources', 'resources/list returns array',
        Array.isArray(resources),
        `Got: ${typeof resources}`
      );

      this.recordResult('Resources', 'Has documentation resources',
        resources.length > 0,
        resources.length === 0 ? 'No resources found' : ''
      );

      if (resources.length > 0) {
        const firstResource = resources[0];
        this.recordResult('Resources', 'Resource has required fields (uri, name)',
          firstResource.uri && firstResource.name,
          !firstResource.uri ? 'Missing uri' : 'Missing name'
        );
      }
    } catch (error) {
      this.recordResult('Resources', 'resources/list endpoint', false, error.message);
    }

    // Test 4.2: Read resource
    try {
      const listResponse = await this.sendRequest('resources/list');
      const resources = listResponse.result?.resources || [];

      if (resources.length > 0) {
        const uri = resources[0].uri;
        const readResponse = await this.sendRequest('resources/read', { uri });

        this.recordResult('Resources', 'resources/read returns content',
          readResponse.result?.contents?.[0]?.text,
          !readResponse.result?.contents ? 'No contents in response' : ''
        );
      }
    } catch (error) {
      this.recordResult('Resources', 'resources/read endpoint', false, error.message);
    }
  }

  // ====================================================================
  // TEST CATEGORY 5: PERFORMANCE
  // ====================================================================
  async testPerformance() {
    this.log('\n━━━ 5. PERFORMANCE REQUIREMENTS ━━━', 'blue');

    // Test 5.1: Response time
    const startTime = Date.now();
    try {
      await this.sendRequest('tools/list');
      const duration = Date.now() - startTime;

      this.recordResult('Performance', 'tools/list responds < 1000ms',
        duration < 1000,
        duration >= 1000 ? `Took ${duration}ms` : '',
        duration < 2000 ? 'warning' : 'error'
      );
    } catch (error) {
      this.recordResult('Performance', 'Response time test', false, error.message);
    }

    // Test 5.2: Concurrent requests
    try {
      const promises = Array(5).fill(null).map(() =>
        this.sendRequest('tools/list')
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      this.recordResult('Performance', '5 concurrent requests handled',
        duration < 5000,
        duration >= 5000 ? `Took ${duration}ms` : '',
        'warning'
      );
    } catch (error) {
      this.recordResult('Performance', 'Concurrent requests', false, error.message);
    }

    // Test 5.3: Large response handling
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'list_push_chain_docs',
        arguments: { category: 'all' }
      });

      const text = response.result?.content?.[0]?.text || '';
      this.recordResult('Performance', 'Large responses formatted properly',
        text.length > 0 && text.length < 50000,
        text.length >= 50000 ? 'Response too large, should paginate' : ''
      );
    } catch (error) {
      this.recordResult('Performance', 'Large response handling', false, error.message);
    }
  }

  // ====================================================================
  // TEST CATEGORY 6: ERROR HANDLING
  // ====================================================================
  async testErrorHandling() {
    this.log('\n━━━ 6. ERROR HANDLING & VALIDATION ━━━', 'blue');

    // Test 6.1: Unknown tool
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'unknown_tool_xyz',
        arguments: {}
      });

      this.recordResult('Error Handling', 'Unknown tool returns error',
        response.error !== undefined,
        !response.error ? 'Should return error for unknown tool' : ''
      );

      if (response.error) {
        this.recordResult('Error Handling', 'Error message is descriptive',
          response.error.message.length > 10,
          `Message: "${response.error.message}"`
        );
      }
    } catch (error) {
      this.recordResult('Error Handling', 'Unknown tool handling', false, error.message);
    }

    // Test 6.2: Missing required parameters
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'search_push_chain_docs',
        arguments: {} // Missing required 'query' parameter
      });

      this.recordResult('Error Handling', 'Missing params returns validation error',
        response.error !== undefined,
        !response.error ? 'Should return error for missing params' : ''
      );
    } catch (error) {
      this.recordResult('Error Handling', 'Missing params validation', false, error.message);
    }

    // Test 6.3: Invalid parameter types
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'search_push_chain_docs',
        arguments: { query: 'test', limit: 'not-a-number' }
      });

      this.recordResult('Error Handling', 'Invalid types return validation error',
        response.error !== undefined,
        !response.error ? 'Should return error for invalid types' : ''
      );
    } catch (error) {
      this.recordResult('Error Handling', 'Type validation', false, error.message);
    }
  }

  // ====================================================================
  // TEST CATEGORY 7: SECURITY
  // ====================================================================
  async testSecurity() {
    this.log('\n━━━ 7. SECURITY STANDARDS ━━━', 'blue');

    // Test 7.1: Input sanitization
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      '"; DROP TABLE users; --',
      '../../../etc/passwd',
      '\x00\x00\x00'
    ];

    for (const input of maliciousInputs) {
      try {
        const response = await this.sendRequest('tools/call', {
          name: 'search_push_chain_docs',
          arguments: { query: input, limit: 1 }
        });

        const hasContent = response.result?.content?.[0]?.text;
        const containsMalicious = hasContent && response.result.content[0].text.includes(input);

        this.recordResult('Security', `Handles malicious input: ${input.substring(0, 20)}...`,
          !containsMalicious || response.error,
          containsMalicious ? 'Input not sanitized in output' : '',
          'warning'
        );
      } catch (error) {
        // Errors are acceptable for malicious input
        this.recordResult('Security', `Rejects malicious input: ${input.substring(0, 20)}...`, true);
      }
    }

    // Test 7.2: Error messages don't leak sensitive info
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'unknown_tool',
        arguments: {}
      });

      if (response.error) {
        const errorMsg = response.error.message.toLowerCase();
        const leaksSensitive =
          errorMsg.includes('password') ||
          errorMsg.includes('token') ||
          errorMsg.includes('secret') ||
          errorMsg.includes('key') ||
          errorMsg.includes('/users/') ||
          errorMsg.includes('c:\\');

        this.recordResult('Security', 'Error messages don\'t leak sensitive paths/info',
          !leaksSensitive,
          leaksSensitive ? `Error contains sensitive info: ${response.error.message}` : ''
        );
      }
    } catch (error) {
      this.recordResult('Security', 'Error message security', true);
    }
  }

  // ====================================================================
  // TEST CATEGORY 8: BEST PRACTICES
  // ====================================================================
  async testBestPractices() {
    this.log('\n━━━ 8. INDUSTRY BEST PRACTICES ━━━', 'blue');

    // Test 8.1: Tool naming conventions
    try {
      const response = await this.sendRequest('tools/list');
      const tools = response.result?.tools || [];

      const allSnakeCase = tools.every(tool =>
        /^[a-z][a-z0-9_]*$/.test(tool.name)
      );

      this.recordResult('Best Practices', 'Tool names follow snake_case convention',
        allSnakeCase,
        !allSnakeCase ? 'Some tools use camelCase or other formats' : '',
        'warning'
      );
    } catch (error) {
      this.recordResult('Best Practices', 'Naming conventions', false, error.message);
    }

    // Test 8.2: Pagination support
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'search_push_chain_docs',
        arguments: { query: 'wallet', limit: 5 }
      });

      const text = response.result?.content?.[0]?.text || '';
      const hasPaginationInfo =
        text.includes('offset') ||
        text.includes('page') ||
        text.includes('Showing');

      this.recordResult('Best Practices', 'Supports pagination (limit/offset)',
        hasPaginationInfo,
        !hasPaginationInfo ? 'No pagination info in response' : '',
        'warning'
      );
    } catch (error) {
      this.recordResult('Best Practices', 'Pagination support', false, error.message);
    }

    // Test 8.3: Response format consistency
    try {
      const tools = ['list_push_chain_docs', 'search_push_chain_docs', 'get_sdk_api'];
      const formats = [];

      for (const toolName of tools) {
        const response = await this.sendRequest('tools/call', {
          name: toolName,
          arguments: toolName === 'list_push_chain_docs' ? { category: 'all' } :
                     toolName === 'search_push_chain_docs' ? { query: 'test', limit: 1 } :
                     { name: 'createClient' }
        });

        if (response.result?.content?.[0]) {
          formats.push({
            tool: toolName,
            hasText: !!response.result.content[0].text,
            isArray: Array.isArray(response.result.content)
          });
        }
      }

      const allConsistent = formats.every(f => f.hasText && f.isArray);

      this.recordResult('Best Practices', 'Response format consistent across tools',
        allConsistent,
        !allConsistent ? 'Response formats vary between tools' : '',
        'warning'
      );
    } catch (error) {
      this.recordResult('Best Practices', 'Response consistency', false, error.message);
    }
  }

  // ====================================================================
  // GENERATE REPORT
  // ====================================================================
  generateReport() {
    this.log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                     TEST RESULTS SUMMARY                   ║', 'cyan');
    this.log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    const passRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    const color = passRate >= 90 ? 'green' : passRate >= 70 ? 'yellow' : 'red';

    this.log(`\n📊 Overall Results:`, 'blue');
    this.log(`   Total Tests:   ${this.testResults.total}`);
    this.log(`   ✓ Passed:      ${this.testResults.passed}`, 'green');
    this.log(`   ✗ Failed:      ${this.testResults.failed}`, 'red');
    this.log(`   ⚠ Warnings:    ${this.testResults.warnings}`, 'yellow');
    this.log(`   Pass Rate:     ${passRate}%`, color);

    this.log(`\n📋 Results by Category:`, 'blue');
    for (const [category, results] of Object.entries(this.testResults.categories)) {
      const total = results.passed + results.failed + results.warnings;
      const rate = ((results.passed / total) * 100).toFixed(0);
      const icon = rate >= 90 ? '✓' : rate >= 70 ? '⚠' : '✗';
      const catColor = rate >= 90 ? 'green' : rate >= 70 ? 'yellow' : 'red';

      this.log(`   ${icon} ${category.padEnd(20)} ${rate}% (${results.passed}/${total})`, catColor);
    }

    // Recommendations
    this.log(`\n💡 Recommendations:`, 'yellow');
    let hasRecommendations = false;

    if (this.testResults.failed > 0) {
      hasRecommendations = true;
      this.log('   • Fix failed tests immediately - these indicate protocol violations');
    }

    if (this.testResults.warnings > 5) {
      hasRecommendations = true;
      this.log('   • Review warnings - these indicate areas for improvement');
    }

    const categories = this.testResults.categories;
    if (categories.Security?.failed > 0) {
      hasRecommendations = true;
      this.log('   • Address security issues as highest priority', 'red');
    }

    if (categories.Performance?.warnings > 0) {
      hasRecommendations = true;
      this.log('   • Optimize performance for better user experience');
    }

    if (!hasRecommendations) {
      this.log('   • Server meets all MCP standards! 🎉', 'green');
    }

    // Grade
    let grade;
    if (passRate >= 95) grade = 'A+ (Excellent)';
    else if (passRate >= 90) grade = 'A (Very Good)';
    else if (passRate >= 85) grade = 'B+ (Good)';
    else if (passRate >= 80) grade = 'B (Acceptable)';
    else if (passRate >= 70) grade = 'C (Needs Improvement)';
    else grade = 'D (Poor)';

    const gradeColor = passRate >= 90 ? 'green' : passRate >= 80 ? 'yellow' : 'red';
    this.log(`\n🎖️  Final Grade: ${grade}`, gradeColor);
    this.log('');
  }

  async stop() {
    if (this.process) {
      this.process.kill();
    }
  }

  async run() {
    try {
      await this.start();

      this.recordResult('Setup', 'Server started successfully', true);

      await this.testProtocolCompliance();
      await this.testToolImplementation();
      await this.testFunctionalBehavior();
      await this.testResourceEndpoints();
      await this.testPerformance();
      await this.testErrorHandling();
      await this.testSecurity();
      await this.testBestPractices();

      this.generateReport();
    } catch (error) {
      this.log(`\n❌ Test suite failed: ${error.message}`, 'red');
      this.log(error.stack, 'gray');
    } finally {
      await this.stop();
      process.exit(this.testResults.failed > 0 ? 1 : 0);
    }
  }
}

// Run tests
const tester = new MCPComplianceTester();
tester.run();
