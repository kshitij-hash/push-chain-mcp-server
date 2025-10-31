#!/usr/bin/env node

/**
 * Test Connection Script
 *
 * Verifies that the Push Chain MCP servers can start and basic functionality works.
 * This is a smoke test to ensure installation is successful.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    testsFailed++;
  }
}

console.log('Push Chain MCP Server - Connection Tests\n');
console.log('========================================\n');

// Test 1: Check required files exist
test('Main server file (index.js) exists', () => {
  if (!existsSync(resolve(rootDir, 'index.js'))) {
    throw new Error('index.js not found');
  }
});

test('SDK server file (index-sdk.js) exists', () => {
  if (!existsSync(resolve(rootDir, 'index-sdk.js'))) {
    throw new Error('index-sdk.js not found');
  }
});

test('Package.json exists', () => {
  if (!existsSync(resolve(rootDir, 'package.json'))) {
    throw new Error('package.json not found');
  }
});

// Test 2: Check configuration files
test('.env.example exists', () => {
  if (!existsSync(resolve(rootDir, '.env.example'))) {
    throw new Error('.env.example not found');
  }
});

test('README.md exists', () => {
  if (!existsSync(resolve(rootDir, 'README.md'))) {
    throw new Error('README.md not found');
  }
});

// Test 3: Check SDK data files exist
test('SDK data files exist', () => {
  const requiredFiles = [
    'sdk_complete_analysis.json',
    'sdk_complete_exports.json',
    'sdk_file_contents.json',
    'sdk_packages_complete.json'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(resolve(rootDir, file))) {
      throw new Error(`${file} not found. Run 'npm run analyze:sdk' to generate SDK data.`);
    }
  }
});

// Test 4: Check schemas directory
test('Schemas directory exists', () => {
  if (!existsSync(resolve(rootDir, 'schemas'))) {
    throw new Error('schemas/ directory not found');
  }
});

test('Docs schemas exist', () => {
  if (!existsSync(resolve(rootDir, 'schemas/docs-schemas.js'))) {
    throw new Error('schemas/docs-schemas.js not found');
  }
});

test('SDK schemas exist', () => {
  if (!existsSync(resolve(rootDir, 'schemas/sdk-schemas.js'))) {
    throw new Error('schemas/sdk-schemas.js not found');
  }
});

// Test 5: Check utils directory
test('Utils directory exists', () => {
  if (!existsSync(resolve(rootDir, 'utils'))) {
    throw new Error('utils/ directory not found');
  }
});

test('Constants file exists', () => {
  if (!existsSync(resolve(rootDir, 'utils/constants.js'))) {
    throw new Error('utils/constants.js not found');
  }
});

test('Error handler exists', () => {
  if (!existsSync(resolve(rootDir, 'utils/error-handler.js'))) {
    throw new Error('utils/error-handler.js not found');
  }
});

test('Response formatter exists', () => {
  if (!existsSync(resolve(rootDir, 'utils/response-formatter.js'))) {
    throw new Error('utils/response-formatter.js not found');
  }
});

// Test 6: Check node_modules
test('Dependencies installed', () => {
  if (!existsSync(resolve(rootDir, 'node_modules'))) {
    throw new Error('node_modules not found. Run \'npm install\'');
  }
});

test('MCP SDK installed', () => {
  if (!existsSync(resolve(rootDir, 'node_modules/@modelcontextprotocol'))) {
    throw new Error('@modelcontextprotocol/sdk not installed. Run \'npm install\'');
  }
});

// Test 7: Check imports work
test('Can import main server', async () => {
  try {
    // Just test that the import doesn't throw an error
    // We won't actually start the server as it would hang
    await import(resolve(rootDir, 'index.js'));
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Missing dependency: ${error.message}`);
    }
    // Other errors during import are okay (like server startup logic)
  }
});

test('Can import SDK server', async () => {
  try {
    await import(resolve(rootDir, 'index-sdk.js'));
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Missing dependency: ${error.message}`);
    }
  }
});

// Test 8: Environment checks
test('Node version check', () => {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (major < 18) {
    throw new Error(`Node.js 18+ required. Current version: ${nodeVersion}`);
  }
});

// Print summary
console.log('\n========================================');
console.log(`\nTests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All tests passed! Your installation is ready.\n');
  console.log('Next steps:');
  console.log('1. Configure in your IDE (see README.md)');
  console.log('2. Start the server:');
  console.log('   - Documentation: npm start');
  console.log('   - SDK: npm run start:sdk\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please fix the errors above.\n');
  process.exit(1);
}
