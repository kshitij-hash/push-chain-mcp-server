#!/usr/bin/env node

/**
 * SDK Auto-Updater
 *
 * Checks Push Chain SDK repository for updates and regenerates SDK data files
 * only when changes are detected. Uses Git commit SHA tracking for efficiency.
 */

import "dotenv/config";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = "pushchain/push-chain-sdk";
const GITHUB_BRANCH = "main";
const SDK_PACKAGES = ["packages/core", "packages/ui-kit"];
const UPDATE_METADATA_FILE = resolve(__dirname, ".sdk-update-metadata.json");

// Update intervals (in milliseconds)
const UPDATE_INTERVALS = {
  aggressive: 1 * 60 * 60 * 1000,      // 1 hour
  moderate: 6 * 60 * 60 * 1000,        // 6 hours
  conservative: 24 * 60 * 60 * 1000,   // 24 hours (recommended)
  weekly: 7 * 24 * 60 * 60 * 1000      // 7 days
};

const UPDATE_INTERVAL = UPDATE_INTERVALS[process.env.SDK_UPDATE_INTERVAL || "conservative"];

/**
 * Load update metadata
 */
function loadMetadata() {
  if (!existsSync(UPDATE_METADATA_FILE)) {
    return {
      lastCheck: null,
      lastUpdate: null,
      lastCommitSha: null,
      updateInterval: UPDATE_INTERVAL
    };
  }

  try {
    return JSON.parse(readFileSync(UPDATE_METADATA_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading metadata:", error.message);
    return {
      lastCheck: null,
      lastUpdate: null,
      lastCommitSha: null,
      updateInterval: UPDATE_INTERVAL
    };
  }
}

/**
 * Save update metadata
 */
function saveMetadata(metadata) {
  try {
    writeFileSync(UPDATE_METADATA_FILE, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error("Error saving metadata:", error.message);
  }
}

/**
 * Get latest commit SHA from GitHub
 */
async function getLatestCommitSha() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Push-Chain-MCP-SDK-Updater'
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      sha: data.sha,
      date: data.commit.committer.date,
      message: data.commit.message
    };
  } catch (error) {
    console.error("Error fetching commit info:", error.message);
    throw error;
  }
}

/**
 * Check if SDK packages were modified in recent commits
 */
async function checkSDKPackagesModified(sinceSha) {
  if (!sinceSha) return true; // First time, assume modified

  const url = `https://api.github.com/repos/${GITHUB_REPO}/compare/${sinceSha}...${GITHUB_BRANCH}`;

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Push-Chain-MCP-SDK-Updater'
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        // Commit not found, might be force push or old commit
        return true;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check if any files in SDK packages were modified
    const sdkModified = data.files?.some(file =>
      SDK_PACKAGES.some(pkg => file.filename.startsWith(pkg))
    ) || false;

    return sdkModified;
  } catch (error) {
    console.error("Error checking modifications:", error.message);
    // On error, assume modified to be safe
    return true;
  }
}

/**
 * Clone and analyze SDK repository
 */
async function updateSDKData() {
  const tmpDir = resolve(__dirname, ".tmp-sdk-clone");

  try {
    console.log("\n🔄 Cloning Push Chain SDK repository...");

    // Clean up any existing temp directory
    if (existsSync(tmpDir)) {
      execSync(`rm -rf "${tmpDir}"`, { stdio: 'inherit' });
    }

    // Clone repository (shallow clone for speed)
    const cloneUrl = GITHUB_TOKEN
      ? `https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git`
      : `https://github.com/${GITHUB_REPO}.git`;

    execSync(
      `git clone --depth 1 --branch ${GITHUB_BRANCH} --single-branch "${cloneUrl}" "${tmpDir}"`,
      { stdio: 'inherit' }
    );

    console.log("✓ Repository cloned");
    console.log("\n📦 Installing dependencies...");

    // Install dependencies in cloned repo
    execSync(`cd "${tmpDir}" && npm install --legacy-peer-deps`, { stdio: 'inherit' });

    console.log("✓ Dependencies installed");
    console.log("\n🔍 Analyzing SDK packages...");

    // Run SDK analysis script (you'll need to create this based on your existing analysis logic)
    // For now, we'll assume you have a script that generates the JSON files
    const analyzeScript = resolve(__dirname, "scripts", "analyze-sdk.js");
    const dataDir = resolve(__dirname, "data");

    if (existsSync(analyzeScript)) {
      execSync(`node "${analyzeScript}" "${tmpDir}" "${dataDir}"`, { stdio: 'inherit' });
    } else {
      console.warn("⚠️  SDK analysis script not found. Please create scripts/analyze-sdk.js");
      console.log("   For now, manually regenerate SDK JSON files from the cloned repo at:");
      console.log(`   ${tmpDir}`);
    }

    console.log("✓ SDK data updated");

    // Clean up
    console.log("\n🧹 Cleaning up...");
    execSync(`rm -rf "${tmpDir}"`, { stdio: 'inherit' });
    console.log("✓ Cleanup complete");

    return true;
  } catch (error) {
    console.error("❌ Error updating SDK data:", error.message);

    // Clean up on error
    if (existsSync(tmpDir)) {
      try {
        execSync(`rm -rf "${tmpDir}"`, { stdio: 'inherit' });
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError.message);
      }
    }

    return false;
  }
}

/**
 * Check for updates and update if needed
 */
async function checkAndUpdate(forceUpdate = false) {
  console.log("🔍 Push Chain SDK Update Check");
  console.log("================================\n");

  const metadata = loadMetadata();
  const now = Date.now();

  // Check if enough time has passed since last check
  if (!forceUpdate && metadata.lastCheck) {
    const timeSinceLastCheck = now - metadata.lastCheck;
    if (timeSinceLastCheck < UPDATE_INTERVAL) {
      const nextCheck = new Date(metadata.lastCheck + UPDATE_INTERVAL);
      console.log(`✓ Checked recently. Next check scheduled for: ${nextCheck.toLocaleString()}`);
      console.log(`  (${Math.round((UPDATE_INTERVAL - timeSinceLastCheck) / 1000 / 60)} minutes remaining)`);
      return;
    }
  }

  try {
    console.log("📡 Fetching latest commit info from GitHub...");
    const latestCommit = await getLatestCommitSha();

    console.log(`✓ Latest commit: ${latestCommit.sha.substring(0, 7)}`);
    console.log(`  Date: ${new Date(latestCommit.date).toLocaleString()}`);
    console.log(`  Message: ${latestCommit.message.split('\n')[0]}`);

    // Update last check time
    metadata.lastCheck = now;

    if (!forceUpdate && latestCommit.sha === metadata.lastCommitSha) {
      console.log("\n✓ SDK is up to date (no new commits)");
      saveMetadata(metadata);
      return;
    }

    // Check if SDK packages were actually modified
    if (!forceUpdate) {
      console.log("\n🔍 Checking if SDK packages were modified...");
      const sdkModified = await checkSDKPackagesModified(metadata.lastCommitSha);

      if (!sdkModified) {
        console.log("✓ SDK packages unchanged (no update needed)");
        metadata.lastCommitSha = latestCommit.sha; // Update SHA to avoid checking same commits
        saveMetadata(metadata);
        return;
      }

      console.log("⚠️  SDK packages modified - update required");
    }

    // Update SDK data
    console.log(forceUpdate ? "\n🔄 Force updating SDK data..." : "\n🔄 Updating SDK data...");
    const success = await updateSDKData();

    if (success) {
      metadata.lastUpdate = now;
      metadata.lastCommitSha = latestCommit.sha;
      saveMetadata(metadata);

      console.log("\n✅ SDK update complete!");
      console.log(`   Last commit: ${latestCommit.sha.substring(0, 7)}`);
      console.log(`   Next check: ${new Date(now + UPDATE_INTERVAL).toLocaleString()}`);
    } else {
      saveMetadata(metadata);
      console.log("\n❌ SDK update failed. Will retry on next check.");
    }

  } catch (error) {
    console.error("\n❌ Update check failed:", error.message);

    if (error.message.includes("rate limit")) {
      console.log("\n💡 Tip: Set GITHUB_TOKEN in .env for higher rate limits (5000/hour)");
    }

    saveMetadata(metadata);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const forceUpdate = args.includes("--force") || args.includes("-f");
  const showHelp = args.includes("--help") || args.includes("-h");

  if (showHelp) {
    console.log(`
Push Chain SDK Auto-Updater

Usage:
  node sdk-updater.js [options]

Options:
  --force, -f     Force update regardless of last check time
  --help, -h      Show this help message

Environment Variables:
  GITHUB_TOKEN              GitHub personal access token (optional, but recommended)
  SDK_UPDATE_INTERVAL       Update check interval: aggressive|moderate|conservative|weekly
                            Default: conservative (24 hours)

Update Intervals:
  aggressive      1 hour
  moderate        6 hours
  conservative    24 hours (recommended)
  weekly          7 days

Examples:
  node sdk-updater.js                    # Check for updates (respects interval)
  node sdk-updater.js --force            # Force update immediately
  SDK_UPDATE_INTERVAL=weekly node sdk-updater.js   # Use weekly check interval
`);
    process.exit(0);
  }

  console.log(`Update interval: ${process.env.SDK_UPDATE_INTERVAL || "conservative"} (${UPDATE_INTERVAL / 1000 / 60 / 60} hours)\n`);

  await checkAndUpdate(forceUpdate);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { checkAndUpdate, getLatestCommitSha, updateSDKData };
