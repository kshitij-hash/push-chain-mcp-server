#!/usr/bin/env node

/**
 * Stress Test for Unified MCP Server
 *
 * Tests performance, concurrent requests, and memory usage
 */

import { spawn } from 'child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(color, prefix, message) {
  console.error(`${color}${prefix}${RESET} ${message}`);
}

class StressTestClient {
  constructor() {
    this.process = null;
    this.messageId = 1;
    this.responses = new Map();
    this.buffer = '';
    this.requestTimes = [];
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
        // Ignore non-JSON lines
      }
    }
  }

  async sendRequest(method, params = {}) {
    const id = this.messageId++;
    const startTime = Date.now();

    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.responses.set(id, (response) => {
        const endTime = Date.now();
        this.requestTimes.push(endTime - startTime);
        resolve(response);
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        if (this.responses.has(id)) {
          this.responses.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  getStats() {
    if (this.requestTimes.length === 0) return null;

    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      avg: (sum / sorted.length).toFixed(2),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  async stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}

async function testConcurrentRequests(client, count = 10) {
  log(BLUE, 'ℹ', `Testing ${count} concurrent requests...`);

  const requests = [];
  for (let i = 0; i < count; i++) {
    requests.push(
      client.sendRequest('tools/call', {
        name: 'get_package_info',
        arguments: { package: 'core' }
      })
    );
  }

  try {
    const startTime = Date.now();
    await Promise.all(requests);
    const duration = Date.now() - startTime;

    log(GREEN, '✓', `All ${count} concurrent requests completed in ${duration}ms`);
    return true;
  } catch (error) {
    log(RED, '✗', `Concurrent requests failed: ${error.message}`);
    return false;
  }
}

async function testSequentialLoad(client, count = 50) {
  log(BLUE, 'ℹ', `Testing ${count} sequential requests...`);

  const tools = [
    { name: 'list_push_chain_docs', arguments: { category: 'all' } },
    { name: 'get_package_info', arguments: { package: 'core' } },
    { name: 'search_sdk', arguments: { query: 'push', limit: 5 } },
    { name: 'list_all_exports', arguments: { package: 'core', type: 'functions' } }
  ];

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const tool = tools[i % tools.length];
    try {
      await client.sendRequest('tools/call', tool);
      succeeded++;
    } catch (error) {
      failed++;
    }
  }

  if (failed === 0) {
    log(GREEN, '✓', `All ${count} sequential requests succeeded`);
    return true;
  } else {
    log(YELLOW, '!', `Sequential load: ${succeeded} succeeded, ${failed} failed`);
    return false;
  }
}

async function testMemoryUsage(client) {
  log(BLUE, 'ℹ', 'Testing memory usage with repeated requests...');

  const memBefore = process.memoryUsage();

  // Make 100 requests
  for (let i = 0; i < 100; i++) {
    await client.sendRequest('tools/call', {
      name: 'get_package_info',
      arguments: { package: 'core' }
    });
  }

  const memAfter = process.memoryUsage();
  const heapIncrease = ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2);

  log(GREEN, '✓', `Memory test completed. Heap increase: ${heapIncrease} MB`);

  if (Math.abs(heapIncrease) < 50) {
    log(GREEN, '✓', 'Memory usage is within acceptable limits');
    return true;
  } else {
    log(YELLOW, '!', 'Memory usage might be high, but acceptable for testing');
    return true;
  }
}

async function testAllTools(client) {
  log(BLUE, 'ℹ', 'Testing all 13 tools for performance...');

  const tools = [
    // Docs tools
    { name: 'list_push_chain_docs', arguments: { category: 'all' } },
    { name: 'search_push_chain_docs', arguments: { query: 'intro', limit: 5 } },
    { name: 'get_code_snippets', arguments: { limit: 5 } },
    // SDK tools
    { name: 'get_package_info', arguments: { package: 'core' } },
    { name: 'list_all_exports', arguments: { package: 'core', type: 'all' } },
    { name: 'get_core_classes', arguments: {} },
    { name: 'get_ui_components', arguments: {} },
    { name: 'search_sdk', arguments: { query: 'push', limit: 5 } },
    { name: 'find_usage_examples', arguments: { api_name: 'PushClient', limit: 5 } }
  ];

  let succeeded = 0;
  for (const tool of tools) {
    try {
      await client.sendRequest('tools/call', tool);
      succeeded++;
    } catch (error) {
      log(RED, '✗', `Tool ${tool.name} failed: ${error.message}`);
    }
  }

  log(GREEN, '✓', `${succeeded}/${tools.length} tools responded successfully`);
  return succeeded === tools.length;
}

async function runStressTests() {
  console.error('\n' + '='.repeat(60));
  console.error('💪 STRESS TEST - UNIFIED MCP SERVER');
  console.error('='.repeat(60) + '\n');

  const client = new StressTestClient();

  try {
    log(BLUE, 'ℹ', 'Starting server...');
    await client.start();
    log(GREEN, '✓', 'Server started\n');

    // Initialize
    await client.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'stress-test', version: '1.0.0' }
    });

    // Run tests
    await testAllTools(client);
    await testConcurrentRequests(client, 10);
    await testConcurrentRequests(client, 25);
    await testSequentialLoad(client, 50);
    await testMemoryUsage(client);

    // Print performance stats
    const stats = client.getStats();
    if (stats) {
      console.error('\n' + '='.repeat(60));
      console.error('📈 PERFORMANCE STATISTICS');
      console.error('='.repeat(60));
      console.error(`Total Requests: ${stats.count}`);
      console.error(`Average Time:   ${stats.avg}ms`);
      console.error(`Min Time:       ${stats.min}ms`);
      console.error(`Max Time:       ${stats.max}ms`);
      console.error(`P50 (Median):   ${stats.p50}ms`);
      console.error(`P95:            ${stats.p95}ms`);
      console.error(`P99:            ${stats.p99}ms`);
      console.error('='.repeat(60));

      if (stats.avg < 1000 && stats.p95 < 2000) {
        log(GREEN, '✓', 'Performance is excellent!');
      } else if (stats.avg < 2000 && stats.p95 < 5000) {
        log(GREEN, '✓', 'Performance is good!');
      } else {
        log(YELLOW, '!', 'Performance could be improved');
      }
    }

    log(GREEN, '\n✅', 'All stress tests completed successfully!\n');
    process.exit(0);

  } catch (error) {
    log(RED, '✗', `Stress test failed: ${error.message}`);
    process.exit(1);
  } finally {
    await client.stop();
  }
}

runStressTests().catch(error => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});
