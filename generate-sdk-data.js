#!/usr/bin/env node

/**
 * Generate SDK data files from Push Chain GitHub repository
 * Fetches source files from core, shared-components, and ui-kit packages
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import fetch from 'node-fetch';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = 'pushchain';
const REPO_NAME = 'push-chain-sdk';
const BRANCH = 'main';
const PACKAGES = ['core', 'shared-components', 'ui-kit'];

const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'push-chain-mcp-server'
};

// Add authorization header only if token is provided
if (GITHUB_TOKEN) {
  headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
}

/**
 * Fetch directory contents from GitHub API
 */
async function fetchGitHubContents(path) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
  console.error(`Fetching: ${path}`);

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`  ✗ Not found: ${path}`);
        return null;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`  ✗ Error fetching ${path}:`, error.message);
    throw error;
  }
}

/**
 * Fetch file content
 */
async function fetchFileContent(downloadUrl) {
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  return await response.text();
}

/**
 * Recursively fetch all TypeScript/JavaScript files
 */
async function fetchAllSourceFiles(path, files = []) {
  const contents = await fetchGitHubContents(path);

  if (!contents || !Array.isArray(contents)) {
    return files;
  }

  for (const item of contents) {
    if (item.type === 'file') {
      // Only include source files
      if (item.name.match(/\.(ts|tsx|js|jsx)$/) && !item.name.endsWith('.test.ts') && !item.name.endsWith('.spec.ts')) {
        console.error(`  ✓ Found: ${item.name}`);
        files.push({
          name: item.name,
          path: item.path,
          downloadUrl: item.download_url,
          sha: item.sha,
          size: item.size
        });
      }
    } else if (item.type === 'dir' && !item.name.includes('test') && !item.name.includes('__tests__')) {
      await fetchAllSourceFiles(item.path, files);
    }
  }

  return files;
}

/**
 * Extract exports from TypeScript/JavaScript code
 */
function extractExports(content, filePath) {
  const exports = {
    functions: [],
    classes: [],
    types: [],
    interfaces: [],
    constants: []
  };

  // Extract exported functions
  const funcPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    exports.functions.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract exported classes
  const classPattern = /export\s+(?:abstract\s+)?class\s+(\w+)/g;
  while ((match = classPattern.exec(content)) !== null) {
    exports.classes.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract exported types
  const typePattern = /export\s+type\s+(\w+)/g;
  while ((match = typePattern.exec(content)) !== null) {
    exports.types.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract exported interfaces
  const interfacePattern = /export\s+interface\s+(\w+)/g;
  while ((match = interfacePattern.exec(content)) !== null) {
    exports.interfaces.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract exported constants
  const constPattern = /export\s+const\s+(\w+)/g;
  while ((match = constPattern.exec(content)) !== null) {
    exports.constants.push({
      name: match[1],
      file: filePath
    });
  }

  return exports;
}

/**
 * Fetch package.json for a package
 */
async function fetchPackageJson(packageName) {
  const path = `packages/${packageName}/package.json`;
  console.error(`\nFetching package.json for ${packageName}...`);

  try {
    const contents = await fetchGitHubContents(path);
    if (!contents || !contents.download_url) {
      console.error(`  ✗ package.json not found for ${packageName}`);
      return null;
    }

    const content = await fetchFileContent(contents.download_url);
    const pkg = JSON.parse(content);
    console.error(`  ✓ Found: ${pkg.name}@${pkg.version}`);
    return pkg;
  } catch (error) {
    console.error(`  ✗ Error fetching package.json:`, error.message);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.error('='.repeat(60));
  console.error('Push Chain SDK Data Generator');
  console.error('='.repeat(60));
  console.error(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.error(`Branch: ${BRANCH}`);
  console.error(`Packages: ${PACKAGES.join(', ')}`);
  console.error('='.repeat(60));

  const allFiles = [];
  const fileContents = {};
  const allExports = {
    functions: [],
    classes: [],
    types: [],
    interfaces: [],
    constants: []
  };
  const packages = [];

  // Fetch each package
  for (const packageName of PACKAGES) {
    console.error(`\n[${'='.repeat(40)}]`);
    console.error(`Processing package: ${packageName}`);
    console.error(`[${'='.repeat(40)}]`);

    // Fetch package.json
    const pkg = await fetchPackageJson(packageName);
    if (pkg) {
      packages.push(pkg);
    }

    // Fetch source files
    const srcPath = `packages/${packageName}/src`;
    console.error(`\nScanning source files in ${srcPath}...`);

    const files = await fetchAllSourceFiles(srcPath);
    console.error(`  ✓ Found ${files.length} source files\n`);

    allFiles.push(...files);

    // Fetch content and extract exports
    for (const file of files) {
      try {
        console.error(`Processing: ${file.path}`);
        const content = await fetchFileContent(file.downloadUrl);
        fileContents[file.path] = content;

        const exports = extractExports(content, file.path);
        allExports.functions.push(...exports.functions);
        allExports.classes.push(...exports.classes);
        allExports.types.push(...exports.types);
        allExports.interfaces.push(...exports.interfaces);
        allExports.constants.push(...exports.constants);

        console.error(`  ✓ Extracted: ${exports.functions.length} functions, ${exports.classes.length} classes, ${exports.types.length} types, ${exports.interfaces.length} interfaces`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ✗ Error processing ${file.path}:`, error.message);
      }
    }
  }

  // Generate summary
  console.error('\n' + '='.repeat(60));
  console.error('SUMMARY');
  console.error('='.repeat(60));
  console.error(`Total source files: ${allFiles.length}`);
  console.error(`Total functions: ${allExports.functions.length}`);
  console.error(`Total classes: ${allExports.classes.length}`);
  console.error(`Total types: ${allExports.types.length}`);
  console.error(`Total interfaces: ${allExports.interfaces.length}`);
  console.error(`Total constants: ${allExports.constants.length}`);
  console.error(`Total packages: ${packages.length}`);

  // Write data files
  console.error('\n' + '='.repeat(60));
  console.error('Writing data files...');
  console.error('='.repeat(60));

  // 1. sdk_file_contents.json
  console.error('Writing data/sdk_file_contents.json...');
  writeFileSync('data/sdk_file_contents.json', JSON.stringify(fileContents, null, 2));
  console.error(`  ✓ Written (${Object.keys(fileContents).length} files)`);

  // 2. sdk_complete_exports.json
  console.error('Writing data/sdk_complete_exports.json...');
  writeFileSync('data/sdk_complete_exports.json', JSON.stringify(allExports, null, 2));
  console.error(`  ✓ Written (${allExports.functions.length + allExports.classes.length + allExports.types.length + allExports.interfaces.length} exports)`);

  // 3. sdk_packages_complete.json
  console.error('Writing data/sdk_packages_complete.json...');
  writeFileSync('data/sdk_packages_complete.json', JSON.stringify({ packages }, null, 2));
  console.error(`  ✓ Written (${packages.length} packages)`);

  // 4. sdk_complete_analysis.json
  console.error('Writing data/sdk_complete_analysis.json...');
  const analysis = {
    metadata: {
      repository: `${REPO_OWNER}/${REPO_NAME}`,
      branch: BRANCH,
      generatedAt: new Date().toISOString(),
      totalFiles: allFiles.length,
      packages: PACKAGES
    },
    files: allFiles,
    statistics: {
      totalFunctions: allExports.functions.length,
      totalClasses: allExports.classes.length,
      totalTypes: allExports.types.length,
      totalInterfaces: allExports.interfaces.length,
      totalConstants: allExports.constants.length
    }
  };
  writeFileSync('data/sdk_complete_analysis.json', JSON.stringify(analysis, null, 2));
  console.error(`  ✓ Written`);

  console.error('\n' + '='.repeat(60));
  console.error('SUCCESS! All data files generated.');
  console.error('='.repeat(60));
  console.error('\nYou can now start the MCP server with:');
  console.error('  node index-sdk.js');
  console.error('\nOr restart Claude Code to connect the push-chain-sdk server.');
}

main().catch(error => {
  console.error('\n' + '='.repeat(60));
  console.error('FATAL ERROR');
  console.error('='.repeat(60));
  console.error(error);
  process.exit(1);
});
