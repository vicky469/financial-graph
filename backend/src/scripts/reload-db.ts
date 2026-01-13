#!/usr/bin/env bun
/**
 * Reload Database Script
 * 
 * Reloads the database by running all ingestion steps in order.
 * 
 * Usage:
 *   bun src/scripts/reload-db.ts [env]
 * 
 * Arguments:
 *   env - Environment to use: 'dev' (default) or 'test'
 * 
 * Examples:
 *   bun src/scripts/reload-db.ts          # Uses dev environment
 *   bun src/scripts/reload-db.ts dev      # Uses dev environment
 *   bun src/scripts/reload-db.ts test     # Uses test environment
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// Parse command line arguments
const args = process.argv.slice(2);
const env = args[0] || "dev";

if (!["dev", "test"].includes(env)) {
  console.error(`❌ Invalid environment: ${env}`);
  console.error(`   Valid options: dev, test`);
  process.exit(1);
}

// Set environment variables based on the selected environment
if (env === "test") {
  process.env.INSTANT_APP_ID = process.env.INSTANT_APP_ID_TEST;
  process.env.INSTANT_ADMIN_SECRET = process.env.INSTANT_ADMIN_SECRET_TEST;
  console.log("🧪 Using TEST environment");
} else {
  console.log("🚀 Using DEV environment");
}

console.log(`\n📊 Reloading database for ${env.toUpperCase()} environment\n`);

// Helper function to run commands
function runCommand(command: string, description: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶️  ${description}`);
  console.log(`${"=".repeat(60)}\n`);
  
  try {
    execSync(command, {
      stdio: "inherit",
      cwd: join(__dirname, "../.."),
      env: process.env,
    });
    console.log(`\n✅ ${description} completed\n`);
  } catch (error) {
    console.error(`\n❌ ${description} failed\n`);
    process.exit(1);
  }
}

// Run ingestion steps in order
const startTime = Date.now();

console.log("📋 Ingestion Order:");
console.log("  1. Tickers");
console.log("  2. Filings (includes EX-21 and EX-8)");
console.log("  3. Subsidiaries");
console.log("  4. Mark SP500 companies");
console.log("  5. Mark Trust companies");
console.log("");

// Step 1: Ingest tickers
runCommand("bun run ingest:tickers", "Step 1: Ingest Tickers");

// Step 2: Ingest filings (includes ex21 and ex8)
runCommand("bun run ingest:filings", "Step 2: Ingest Filings (includes EX-21 and EX-8)");

// Step 3: Ingest subsidiaries
runCommand("bun run ingest:subsidiaries", "Step 3: Ingest Subsidiaries");

// Step 4: Mark SP500 companies
runCommand("bun run mark:sp500", "Step 4: Mark SP500 Companies");

// Step 5: Mark Trust companies
runCommand("bun run mark:trust", "Step 5: Mark Trust Companies");

const endTime = Date.now();
const duration = Math.round((endTime - startTime) / 1000);
const minutes = Math.floor(duration / 60);
const seconds = duration % 60;

console.log("\n" + "=".repeat(60));
console.log("🎉 Database reload completed successfully!");
console.log("=".repeat(60));
console.log(`⏱️  Total time: ${minutes}m ${seconds}s`);
console.log(`🌍 Environment: ${env.toUpperCase()}`);
console.log("=".repeat(60) + "\n");
