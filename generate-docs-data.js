#!/usr/bin/env node

/**
 * Documentation Data Generator
 *
 * Fetches all Push Chain documentation from GitHub and caches it locally.
 * Similar to generate-sdk-data.js but for documentation files.
 */

import "dotenv/config";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { GITHUB_CONFIG } from "./utils/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

function shouldIncludeFile(filename) {
  if (filename.endsWith(".mdx.deprecated")) return false;
  if (filename.toUpperCase().includes("CHANGELOG")) return false;
  return filename.endsWith(".mdx");
}

async function fetchGitHubContents(path) {
  const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
  const params = new URLSearchParams({ ref: GITHUB_CONFIG.branch });

  try {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Push-Chain-MCP-Server'
    };

    if (GITHUB_TOKEN) {
      const authScheme = GITHUB_TOKEN.startsWith('github_pat_') ? 'Bearer' : 'token';
      headers['Authorization'] = `${authScheme} ${GITHUB_TOKEN}`;
    }

    const response = await fetch(`${url}?${params}`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${path}:`, error.message);
    throw error;
  }
}

async function fetchAllMdxFiles(path = GITHUB_CONFIG.basePath) {
  const files = [];
  const contents = await fetchGitHubContents(path);

  if (!Array.isArray(contents)) {
    return files;
  }

  for (const item of contents) {
    if (item.type === "file" && shouldIncludeFile(item.name)) {
      files.push({
        name: item.name,
        path: item.path,
        downloadUrl: item.download_url,
        htmlUrl: item.html_url,
        sha: item.sha
      });
    } else if (item.type === "dir") {
      const subFiles = await fetchAllMdxFiles(item.path);
      files.push(...subFiles);
    }
  }

  return files;
}

async function fetchFileContent(downloadUrl) {
  try {
    const headers = {
      'Accept': 'application/vnd.github.raw',
      'User-Agent': 'Push-Chain-MCP-Server'
    };

    if (GITHUB_TOKEN) {
      const authScheme = GITHUB_TOKEN.startsWith('github_pat_') ? 'Bearer' : 'token';
      headers['Authorization'] = `${authScheme} ${GITHUB_TOKEN}`;
    }

    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    throw error;
  }
}

function parseDocumentation(content, path) {
  const lines = content.split('\n');
  const metadata = {};
  let description = '';
  let codeSnippets = [];
  let inCodeBlock = false;
  let currentCodeBlock = { language: '', code: '' };

  // Extract frontmatter if exists
  if (lines[0]?.trim() === '---') {
    let i = 1;
    while (i < lines.length && lines[i].trim() !== '---') {
      const line = lines[i];
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
      i++;
    }
  }

  // Extract first paragraph as description
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('import')) {
      description = line.trim();
      break;
    }
  }

  // Extract code snippets
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        currentCodeBlock.language = line.slice(3).trim() || 'text';
        currentCodeBlock.code = '';
      } else {
        inCodeBlock = false;
        codeSnippets.push({ ...currentCodeBlock });
        currentCodeBlock = { language: '', code: '' };
      }
    } else if (inCodeBlock) {
      currentCodeBlock.code += line + '\n';
    }
  }

  return {
    metadata,
    description: description || metadata.title || path,
    codeSnippets,
    fullContent: content
  };
}

async function generateDocsData() {
  console.log("🔄 Push Chain Documentation Data Generator");
  console.log("==========================================\n");

  if (!GITHUB_TOKEN) {
    console.error("❌ Error: GITHUB_TOKEN not found in environment variables");
    console.error("   Please set GITHUB_TOKEN in .env file");
    process.exit(1);
  }

  console.log(`📚 Fetching documentation from: ${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`);
  console.log(`   Branch: ${GITHUB_CONFIG.branch}`);
  console.log(`   Path: ${GITHUB_CONFIG.basePath}\n`);

  try {
    // Fetch all documentation files
    console.log("1️⃣  Fetching documentation file list...");
    const docFiles = await fetchAllMdxFiles();
    console.log(`   ✓ Found ${docFiles.length} documentation files\n`);

    // Fetch content for each file
    console.log("2️⃣  Fetching documentation content...");
    const docsWithContent = [];

    for (let i = 0; i < docFiles.length; i++) {
      const doc = docFiles[i];
      process.stdout.write(`   [${i + 1}/${docFiles.length}] ${doc.name}...`);

      try {
        const content = await fetchFileContent(doc.downloadUrl);
        const parsed = parseDocumentation(content, doc.path);

        docsWithContent.push({
          ...doc,
          content: content,
          metadata: parsed.metadata,
          description: parsed.description,
          codeSnippets: parsed.codeSnippets
        });

        console.log(" ✓");
      } catch (error) {
        console.log(` ✗ (${error.message})`);
      }
    }

    console.log(`\n   ✓ Successfully fetched ${docsWithContent.length} documentation files\n`);

    // Save to JSON file
    console.log("3️⃣  Saving documentation data...");
    const outputPath = resolve(__dirname, "data/docs_cache.json");

    const docsData = {
      generatedAt: new Date().toISOString(),
      source: {
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        branch: GITHUB_CONFIG.branch,
        basePath: GITHUB_CONFIG.basePath
      },
      totalFiles: docsWithContent.length,
      docs: docsWithContent
    };

    writeFileSync(outputPath, JSON.stringify(docsData, null, 2));
    console.log(`   ✓ Saved to: ${outputPath}`);
    console.log(`   Size: ${(JSON.stringify(docsData).length / 1024).toFixed(2)} KB\n`);

    // Summary
    console.log("📊 Summary:");
    console.log(`   - Total documentation files: ${docsData.totalFiles}`);
    console.log(`   - Total code snippets: ${docsWithContent.reduce((sum, doc) => sum + doc.codeSnippets.length, 0)}`);

    const categories = {
      tutorials: docsWithContent.filter(d => d.path.includes('/01-tutorials/')).length,
      setup: docsWithContent.filter(d => d.path.includes('/02-setup/')).length,
      build: docsWithContent.filter(d => d.path.includes('/03-build/')).length,
      'ui-kit': docsWithContent.filter(d => d.path.includes('/04-ui-kit/')).length,
      'deep-dives': docsWithContent.filter(d => d.path.includes('/05-deep-dives/')).length
    };

    console.log("\n   Categories:");
    for (const [name, count] of Object.entries(categories)) {
      if (count > 0) {
        console.log(`     - ${name}: ${count}`);
      }
    }

    console.log("\n✅ Documentation data generation complete!");
    console.log("   You can now run the server without needing a GitHub token for docs.\n");

  } catch (error) {
    console.error("\n❌ Error generating documentation data:", error.message);
    process.exit(1);
  }
}

generateDocsData().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
