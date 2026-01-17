/**
 * Run Subsidiaries Pipeline
 *
 * Test script to see the pipeline flow in action.
 *
 * Usage:
 *   bun run src/pipeline/subsidiaries/run.ts
 *   bun run src/pipeline/subsidiaries/run.ts --limit=5 --dry-run
 *   bun run src/pipeline/subsidiaries/run.ts --sp500 --sink=db
 */

import "dotenv/config";
import { createSubsidiariesPipeline } from "./index";
import { createLogger } from "../../utils/logger";

const logger = createLogger("pipeline/subsidiaries");

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);

  const getArg = (name: string) => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg?.split("=")[1];
  };

  const hasFlag = (name: string) => args.includes(`--${name}`);

  return {
    limit: getArg("limit") ? parseInt(getArg("limit")!) : undefined,
    sp500Only: hasFlag("sp500"),
    dryRun: hasFlag("dry-run"),
    sinks: getArg("sink")?.split(",") || [],
    skipValidation: hasFlag("skip-validation"),
  };
}

async function main() {
  const args = parseArgs();

  console.log("\n" + "=".repeat(60));
  console.log("SUBSIDIARIES PIPELINE");
  console.log("=".repeat(60));
  console.log("Args:", JSON.stringify(args, null, 2));

  // Create pipeline with config
  const pipeline = createSubsidiariesPipeline({
    year: parseInt(process.env.SEC_YEARS!),
    filters: {
      sp500Only: args.sp500Only,
      limit: args.limit,
    },
    steps: {
      skipValidation: args.skipValidation,
    },
    dryRun: args.dryRun || args.sinks.length === 0, // Dry run if no sinks
    sinks: args.sinks,
  });

  console.log("\n" + "-".repeat(60));
  console.log("EXECUTING PIPELINE");
  console.log("-".repeat(60));

  // Execute
  const result = await pipeline.execute();

  console.log("\n" + "-".repeat(60));
  console.log("RESULT");
  console.log("-".repeat(60));
  console.log("Pipeline result:", {
    success: result.success,
    itemsProcessed: result.itemsProcessed,
    itemsSucceeded: result.itemsSucceeded,
    itemsFailed: result.itemsFailed,
    sinkResults: result.sinkResults,
    errorCount: result.errors.length,
  });

  if (result.errors.length > 0) {
    console.log(`\nFound ${result.errors.length} errors`);
    result.errors.slice(0, 5).forEach((e) => {
      console.log(`  [${e.level}:${e.stage}] ${e.message}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("DONE");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
