#!/usr/bin/env node

/**
 * SDK Analyzer
 *
 * Analyzes @pushchain/core and @pushchain/ui-kit packages and generates
 * JSON data files for the MCP SDK server.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { resolve, join } from "path";

const repoPath = process.argv[2] || process.cwd();
const outputDir = process.argv[3] || process.cwd();

console.log(`📂 Repository path: ${repoPath}`);
console.log(`📂 Output directory: ${outputDir}\n`);

/**
 * Recursively get all TypeScript files in a directory
 */
function getAllTsFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build, etc.
      if (!['node_modules', 'dist', 'build', '.next', '.turbo'].includes(file)) {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Extract exports from TypeScript source code
 */
function extractExports(sourceCode, filePath) {
  const exports = {
    functions: [],
    classes: [],
    types: [],
    interfaces: []
  };

  // Extract function exports
  const functionPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = functionPattern.exec(sourceCode)) !== null) {
    exports.functions.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract class exports
  const classPattern = /export\s+(?:abstract\s+)?class\s+(\w+)/g;
  while ((match = classPattern.exec(sourceCode)) !== null) {
    exports.classes.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract type exports
  const typePattern = /export\s+type\s+(\w+)/g;
  while ((match = typePattern.exec(sourceCode)) !== null) {
    exports.types.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract interface exports
  const interfacePattern = /export\s+interface\s+(\w+)/g;
  while ((match = interfacePattern.exec(sourceCode)) !== null) {
    exports.interfaces.push({
      name: match[1],
      file: filePath
    });
  }

  // Extract const/let/var exports (for components, hooks, etc.)
  const constPattern = /export\s+(?:const|let|var)\s+(\w+)/g;
  while ((match = constPattern.exec(sourceCode)) !== null) {
    // If it starts with 'use', likely a hook
    // If it starts with capital letter, likely a component
    const name = match[1];
    if (name.startsWith('use') || /^[A-Z]/.test(name)) {
      exports.functions.push({
        name: name,
        file: filePath
      });
    }
  }

  return exports;
}

/**
 * Get package.json info
 */
function getPackageInfo(packageDir) {
  try {
    const pkgPath = join(packageDir, 'package.json');
    const pkgContent = readFileSync(pkgPath, 'utf-8');
    return JSON.parse(pkgContent);
  } catch (error) {
    console.error(`Error reading package.json from ${packageDir}:`, error.message);
    return null;
  }
}

/**
 * Main analysis function
 */
function analyzeSDK() {
  const packages = ['packages/core', 'packages/ui-kit'];
  const allExports = {
    functions: [],
    classes: [],
    types: [],
    interfaces: []
  };
  const fileContents = {};
  const packagesInfo = { packages: [] };

  for (const pkg of packages) {
    const pkgPath = resolve(repoPath, pkg);
    console.log(`\n📦 Analyzing ${pkg}...`);

    // Get package info
    const pkgInfo = getPackageInfo(pkgPath);
    if (pkgInfo) {
      packagesInfo.packages.push({
        name: pkgInfo.name,
        version: pkgInfo.version,
        description: pkgInfo.description,
        dependencies: pkgInfo.dependencies || {},
        path: pkg
      });
      console.log(`   Name: ${pkgInfo.name}`);
      console.log(`   Version: ${pkgInfo.version}`);
    }

    // Get all TypeScript files
    const tsFiles = getAllTsFiles(pkgPath);
    console.log(`   Found ${tsFiles.length} TypeScript files`);

    let exportCount = 0;

    for (const file of tsFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        // Store relative path from repo root
        const relativePath = file.replace(repoPath + '/', '');
        fileContents[relativePath] = content;

        // Extract exports
        const fileExports = extractExports(content, relativePath);

        allExports.functions.push(...fileExports.functions);
        allExports.classes.push(...fileExports.classes);
        allExports.types.push(...fileExports.types);
        allExports.interfaces.push(...fileExports.interfaces);

        const totalFileExports = Object.values(fileExports).reduce((sum, arr) => sum + arr.length, 0);
        exportCount += totalFileExports;
      } catch (error) {
        console.error(`   Error processing ${file}:`, error.message);
      }
    }

    console.log(`   Extracted ${exportCount} exports`);
  }

  // Write output files
  console.log(`\n💾 Writing output files to ${outputDir}...`);

  writeFileSync(
    resolve(outputDir, 'sdk_file_contents.json'),
    JSON.stringify(fileContents, null, 2)
  );
  console.log(`   ✓ sdk_file_contents.json (${Object.keys(fileContents).length} files)`);

  writeFileSync(
    resolve(outputDir, 'sdk_complete_exports.json'),
    JSON.stringify(allExports, null, 2)
  );
  console.log(`   ✓ sdk_complete_exports.json`);
  console.log(`     - ${allExports.functions.length} functions`);
  console.log(`     - ${allExports.classes.length} classes`);
  console.log(`     - ${allExports.types.length} types`);
  console.log(`     - ${allExports.interfaces.length} interfaces`);

  writeFileSync(
    resolve(outputDir, 'sdk_packages_complete.json'),
    JSON.stringify(packagesInfo, null, 2)
  );
  console.log(`   ✓ sdk_packages_complete.json (${packagesInfo.packages.length} packages)`);

  // Create analysis summary
  const analysis = {
    generatedAt: new Date().toISOString(),
    packages: packagesInfo.packages.map(p => ({
      name: p.name,
      version: p.version,
      path: p.path
    })),
    statistics: {
      totalFiles: Object.keys(fileContents).length,
      totalExports: Object.values(allExports).reduce((sum, arr) => sum + arr.length, 0),
      functions: allExports.functions.length,
      classes: allExports.classes.length,
      types: allExports.types.length,
      interfaces: allExports.interfaces.length
    }
  };

  writeFileSync(
    resolve(outputDir, 'sdk_complete_analysis.json'),
    JSON.stringify(analysis, null, 2)
  );
  console.log(`   ✓ sdk_complete_analysis.json`);

  console.log('\n✅ SDK analysis complete!');

  return analysis;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    analyzeSDK();
  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  }
}

export { analyzeSDK };
