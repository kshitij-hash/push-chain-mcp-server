#!/usr/bin/env node

/**
 * Quick test to verify documentation is loaded correctly
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("🧪 Testing Documentation Loading\n");
console.log("=".repeat(50));

try {
  // Test 1: Check if docs cache file exists
  console.log("\n1️⃣  Checking docs cache file...");
  const docsCachePath = resolve(__dirname, "../data/docs_cache.json");
  const docsCacheData = JSON.parse(readFileSync(docsCachePath, "utf-8"));

  console.log(`   ✓ Found docs_cache.json`);
  console.log(`   ✓ Generated at: ${new Date(docsCacheData.generatedAt).toLocaleString()}`);
  console.log(`   ✓ Total files: ${docsCacheData.totalFiles}`);
  console.log(`   ✓ Source: ${docsCacheData.source.owner}/${docsCacheData.source.repo}`);
  console.log(`   ✓ Branch: ${docsCacheData.source.branch}`);

  // Test 2: Verify docs array structure
  console.log("\n2️⃣  Verifying documentation structure...");
  if (!docsCacheData.docs || !Array.isArray(docsCacheData.docs)) {
    throw new Error("docs array not found or invalid");
  }
  console.log(`   ✓ Docs array is valid with ${docsCacheData.docs.length} items`);

  // Test 3: Check first doc has required fields
  console.log("\n3️⃣  Checking documentation fields...");
  const sampleDoc = docsCacheData.docs[0];
  const requiredFields = ['name', 'path', 'content', 'metadata', 'codeSnippets'];
  const missingFields = requiredFields.filter(field => !(field in sampleDoc));

  if (missingFields.length > 0) {
    throw new Error(`Missing fields: ${missingFields.join(', ')}`);
  }
  console.log(`   ✓ All required fields present`);
  console.log(`   Sample doc: ${sampleDoc.name}`);
  console.log(`   Content length: ${sampleDoc.content?.length || 0} characters`);
  console.log(`   Code snippets: ${sampleDoc.codeSnippets?.length || 0}`);

  // Test 4: Count by category
  console.log("\n4️⃣  Categorizing documentation...");
  const categories = {
    tutorials: docsCacheData.docs.filter(d => d.path.includes('/01-tutorials/')).length,
    setup: docsCacheData.docs.filter(d => d.path.includes('/02-setup/')).length,
    build: docsCacheData.docs.filter(d => d.path.includes('/03-build/')).length,
    'ui-kit': docsCacheData.docs.filter(d => d.path.includes('/04-ui-kit/')).length,
    'deep-dives': docsCacheData.docs.filter(d => d.path.includes('/05-deep-dives/')).length
  };

  for (const [name, count] of Object.entries(categories)) {
    if (count > 0) {
      console.log(`   - ${name}: ${count} files`);
    }
  }

  // Test 5: Total code snippets
  console.log("\n5️⃣  Analyzing code snippets...");
  const totalSnippets = docsCacheData.docs.reduce((sum, doc) => sum + (doc.codeSnippets?.length || 0), 0);
  console.log(`   ✓ Total code snippets: ${totalSnippets}`);

  const languages = {};
  docsCacheData.docs.forEach(doc => {
    doc.codeSnippets?.forEach(snippet => {
      languages[snippet.language] = (languages[snippet.language] || 0) + 1;
    });
  });

  console.log(`   Languages found:`);
  Object.entries(languages).forEach(([lang, count]) => {
    console.log(`     - ${lang}: ${count}`);
  });

  console.log("\n" + "=".repeat(50));
  console.log("✅ All tests passed! Documentation is loaded correctly.\n");

} catch (error) {
  console.error("\n❌ Test failed:", error.message);
  console.error("\nStack trace:", error.stack);
  process.exit(1);
}
