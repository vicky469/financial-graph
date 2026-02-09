/**
 * Subsidiary parsing pipeline runner.
 *
 * Orchestrates target loading, batching, sinks, and worker pool lifecycle.
 */

import { createLogger } from "../../utils/logger";
import { SUBSIDIARY_EXHIBITS } from "../../config/subsidiary-exhibits";
import { shutdownLLMWorkerPool } from "../../utils/llm-worker-pool";
import {
  readTargetsFromFile,
  writeCachedTargetsFile,
} from "../../jobs/parse_subsidiaries/cache";
import { clearCompanyLookupCache } from "../../db/queries/company-lookup";
import type {
  ValidatedFiling,
  SECFilingTarget,
  SinkResult,
} from "../../jobs/parse_subsidiaries/types";
import type {
  ProcessingStats,
  SubsidiaryPipelineOptions,
  SubsidiaryPipelineResult,
  SubsidiarySink,
  SubsidiaryFallbackPolicy,
} from "./types";
import { parseSubsidiaryTarget, parseSubsidiaryTargetSafe } from "./target";
import { initializePipeline } from "./init";
import { parsePipelineArgs } from "./cli";

const logger = createLogger("pipeline/subsidiary/run");

const SINK_BATCH_SIZE = 20;
const TARGET_BATCH_MULTIPLIER = 4;

type Sink = SubsidiarySink;

async function sinkBatch(
  results: ValidatedFiling[],
  sinks: Sink[],
  sinkResults: Record<string, SinkResult>,
): Promise<void> {
  for (let i = 0; i < results.length; i += SINK_BATCH_SIZE) {
    const batch = results.slice(i, i + SINK_BATCH_SIZE);

    for (const sink of sinks) {
      try {
        const start = Date.now();
        const batchResult = await sink.write(batch);
        const time = Date.now() - start;

        sinkResults[sink.name].written += batchResult.written;
        sinkResults[sink.name].errors += batchResult.errors;

        if (batchResult.details) {
          Object.assign(
            sinkResults[sink.name].details || {},
            batchResult.details,
          );
        }

        logger.info(`   ✓ ${sink.name}: +${batchResult.written} (${time}ms)`);
      } catch (error) {
        logger.warn(`   ✗ ${sink.name}: batch failed`);
        sinkResults[sink.name].errors += batch.length;
        logger.error(`Sink ${sink.name} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

async function processTargetBatch(
  targets: SECFilingTarget[],
  options: {
    dryRun: boolean;
    concurrency: number;
    fallbackPolicy: SubsidiaryFallbackPolicy;
  },
  sinks: Sink[],
  stats: ProcessingStats,
  totalTargets: number,
): Promise<void> {
  const concurrency = Math.max(1, options.concurrency);

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);

    const parseTarget =
      options.fallbackPolicy === "none"
        ? parseSubsidiaryTarget
        : parseSubsidiaryTargetSafe;

    const batchResults = await Promise.all(
      batch.map((target) =>
        parseTarget(target, {
          fallbackPolicy: options.fallbackPolicy,
        }),
      ),
    );

    stats.processed += batchResults.length;

    for (const result of batchResults) {
      const status = result.parseResult?.status;
      if (status === "success") {
        stats.successCount += 1;
      } else if (status === "empty") {
        stats.emptyCount += 1;
      } else {
        stats.failedCount += 1;
      }
    }

    if (!options.dryRun && sinks.length > 0) {
      await sinkBatch(batchResults, sinks, stats.sinkResults);
    }

    const pct =
      totalTargets > 0
        ? ((stats.processed / totalTargets) * 100).toFixed(1)
        : "100.0";
    logger.info(`Progress: ${stats.processed}/${totalTargets} (${pct}%)`);
  }
}

export async function runSubsidiaryParsingPipeline(
  options: SubsidiaryPipelineOptions,
): Promise<SubsidiaryPipelineResult> {
  const { fallbackPolicy, jobConcurrency, sinks, dryRun } =
    initializePipeline(options);

  const targetsFile = await writeCachedTargetsFile({
    year: options.year,
    exhibitTypes: SUBSIDIARY_EXHIBITS,
    companyLookup: {
      mode: options.excludeSp500
        ? "exclude-sp500"
        : options.sp500Only
          ? "sp500-only"
          : "all",
    },
    limit: options.limit,
  });

  if (targetsFile.targetCount === 0) {
    logger.warn("No cached filings found. Exiting.");
    return {
      processed: 0,
      successCount: 0,
      emptyCount: 0,
      failedCount: 0,
      sinkResults: {},
      targetCount: targetsFile.targetCount,
      limitedTargetCount: 0,
      dryRun,
    };
  }

  clearCompanyLookupCache();

  logger.info("\n" + "-".repeat(60));
  logger.info("EXECUTING JOB");
  logger.info("-".repeat(60));

  const sinkResults: Record<string, SinkResult> = {};
  for (const sink of sinks) {
    sinkResults[sink.name] = { written: 0, errors: 0, details: {} };
  }

  const stats: ProcessingStats = {
    processed: 0,
    successCount: 0,
    emptyCount: 0,
    failedCount: 0,
    sinkResults,
  };

  const batchSize = Math.max(1, jobConcurrency) * TARGET_BATCH_MULTIPLIER;
  const totalToProcess = targetsFile.targetCount;

  let limitedTargetCount = 0;

  for await (const batch of readTargetsFromFile({
    filePath: targetsFile.filePath,
    batchSize,
  })) {
    if (batch.length === 0) continue;
    limitedTargetCount += batch.length;
    await processTargetBatch(
      batch,
      {
        dryRun,
        concurrency: jobConcurrency,
        fallbackPolicy,
      },
      sinks,
      stats,
      totalToProcess,
    );
  }

  if (fallbackPolicy === "llm") {
    try {
      await shutdownLLMWorkerPool();
    } catch (error) {
      logger.warn("LLM Worker Pool shutdown failed:", { error });
    }
  }

  logger.info("\n" + "-".repeat(60));
  logger.info("Job result:", {
    success: stats.failedCount === 0,
    itemsProcessed: stats.processed,
    itemsSucceeded: stats.successCount + stats.emptyCount,
    itemsFailed: stats.failedCount,
    breakdown: {
      withSubsidiaries: `${stats.successCount} (${stats.processed > 0 ? ((stats.successCount / stats.processed) * 100).toFixed(1) : "0.0"}%)`,
      empty: `${stats.emptyCount} (${stats.processed > 0 ? ((stats.emptyCount / stats.processed) * 100).toFixed(1) : "0.0"}%)`,
      failed: `${stats.failedCount} (${stats.processed > 0 ? ((stats.failedCount / stats.processed) * 100).toFixed(1) : "0.0"}%)`,
    },
    sinkResults: stats.sinkResults,
  });

  if (dryRun) {
    logger.info("\n🔸 Dry run - skipped sinks");
  } else if (sinks.length === 0) {
    logger.info("\n📤 No sinks configured");
  } else {
    logger.info("\n📤 Final sink totals:");
    for (const sink of sinks) {
      const result = stats.sinkResults[sink.name];
      logger.info(
        `   ${sink.name}: ${result.written} written, ${result.errors} errors`,
      );
    }
  }

  logger.info("\n" + "=".repeat(60));
  logger.info("DONE");

  return {
    processed: stats.processed,
    successCount: stats.successCount,
    emptyCount: stats.emptyCount,
    failedCount: stats.failedCount,
    sinkResults: stats.sinkResults,
    targetCount: targetsFile.targetCount,
    limitedTargetCount,
    dryRun,
  };
}

async function main() {
  const args = parsePipelineArgs();

  const year = args.year;
  if (!year || Number.isNaN(year))
    throw new Error("Missing year. Provide --year=YYYY.");

  await runSubsidiaryParsingPipeline({
    year,
    limit: args.limit,
    sp500Only: args.sp500Only,
    excludeSp500: args.excludeSp500,
    dryRun: args.dryRun,
    sinks: args.sinks as ("db" | "excel")[],
    fallbackPolicy: args.fallbackPolicy,
  });
}

if (import.meta.main) {
  main().catch((err) => {
    logger.error("Fatal error in subsidiary pipeline", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}
