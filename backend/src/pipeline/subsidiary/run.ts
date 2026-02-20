/**
 * Subsidiary parsing pipeline runner.
 *
 * Orchestrates target loading, batching, sinks, and worker pool lifecycle.
 */

import { createLogger } from "../../utils/logger";
import { SUBSIDIARY_EXHIBITS } from "../../config/subsidiary-exhibits";
import { getDefaultConcurrency } from "../../utils/concurrency";
import {
  getLLMWorkerPool,
  shutdownLLMWorkerPool,
} from "../../utils/llm-worker-pool";
import { readTargetsFromFile, writeCachedTargetsFile } from "./cache";
import { clearCompanyLookupCache } from "../../db/queries/company-lookup";
import { SubsidiariesDBSink } from "./sinks/db";
import { SubsidiariesCsvSink } from "./sinks/csv";
import type { ValidatedFiling, SECFilingTarget, SinkResult } from "./types";
import type {
  ProcessingStats,
  PipelineContext,
  SubsidiaryPipelineOptions,
  SubsidiaryPipelineResult,
  SubsidiarySink,
  SubsidiarySinkName,
} from "./types";
import { parseSubsidiaryTarget } from "./target";
import { parsePipelineArgs } from "./cli";
import { formatRunTimestamp, normalizeForSinks } from "./util";

const logger = createLogger("pipeline/subsidiary/run");

const SINK_BATCH_SIZE = 20;

type Sink = SubsidiarySink;

function buildSinks(
  names: SubsidiarySinkName[] = [],
  runTimestamp: string,
): SubsidiarySink[] {
  const sinks: SubsidiarySink[] = [];
  const unique = Array.from(new Set(names));
  const wantsDb = unique.includes("db");
  const wantsCsv = unique.includes("csv");

  for (const name of unique) {
    if (name === "db" || name === "csv") continue;
    logger.warn(`Unknown sink "${name}" requested; skipping.`);
  }

  if (wantsDb) sinks.push(new SubsidiariesDBSink());
  if (wantsCsv) sinks.push(new SubsidiariesCsvSink(undefined, runTimestamp));

  return sinks;
}

async function initializeSinks(sinks: Sink[]): Promise<void> {
  for (const sink of sinks) {
    if (typeof sink.initialize === "function") {
      await sink.initialize();
    }
  }
}

function initializePipeline(
  options: SubsidiaryPipelineOptions,
): PipelineContext {
  const runTimestamp = formatRunTimestamp();
  const fallbackPolicy = options.fallbackPolicy ?? "llm";
  const defaults = getDefaultConcurrency(options.limit);
  const jobConcurrency = defaults.job;
  const llmWorkers = defaults.llmWorkers;

  if (fallbackPolicy === "llm") {
    getLLMWorkerPool({ maxWorkers: llmWorkers });
  }

  const sinks = buildSinks(options.sinks ?? [], runTimestamp);
  const dryRun = options.dryRun || sinks.length === 0;

  logger.info("\n" + "=".repeat(60));
  logger.info("SUBSIDIARIES PARSE JOB");
  logger.info("=".repeat(60));
  logger.info("Args: " + JSON.stringify({ ...options }, null, 2));
  logger.info(`⚙️  Concurrency: ${jobConcurrency} filings`);
  logger.info(
    fallbackPolicy === "llm"
      ? `🤖 LLM Pool: ${llmWorkers} workers`
      : "🤖 LLM Pool: disabled",
  );
  logger.info(`🧠 LLM Fallback: ${fallbackPolicy}`);
  logger.info(`🕒 Run timestamp: ${runTimestamp}`);
  
  if (options.accessions && options.accessions.length > 0) {
    logger.info(`🎯 Filtering by ${options.accessions.length} accession(s): ${options.accessions.join(', ')}`);
  }

  return { fallbackPolicy, jobConcurrency, llmWorkers, sinks, dryRun, runTimestamp };
}

async function sinkBatch(
  results: ValidatedFiling[],
  sinks: Sink[],
  sinkResults: Record<string, SinkResult>,
): Promise<void> {
  for (let i = 0; i < results.length; i += SINK_BATCH_SIZE) {
    const batch = results.slice(i, i + SINK_BATCH_SIZE);
    const normalizedBatch = batch.map(normalizeForSinks);

    for (const sink of sinks) {
      try {
        const start = Date.now();
        const batchResult = await sink.write(normalizedBatch);
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

export async function runSubsidiaryParsingPipeline(
  options: SubsidiaryPipelineOptions,
): Promise<SubsidiaryPipelineResult> {
  const { fallbackPolicy, jobConcurrency, sinks, dryRun, runTimestamp } =
    initializePipeline(options);

  if (!dryRun && sinks.length > 0) {
    await initializeSinks(sinks);
  }

  const targetsFile = await writeCachedTargetsFile({
    year: options.year,
    quarters: options.quarters,
    exhibitTypes: SUBSIDIARY_EXHIBITS,
    companyLookup: {
      mode: options.excludeSp500
        ? "exclude-sp500"
        : options.sp500Only
          ? "sp500-only"
          : "all",
    },
    limit: options.limit,
    accessions: options.accessions,
    timestampSuffix: runTimestamp,
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

  const concurrency = Math.max(1, jobConcurrency);
  const totalToProcess = targetsFile.targetCount;
  let limitedTargetCount = 0;

  // Flatten the chunked stream into a single async iterator of targets
  async function* allTargets(): AsyncGenerator<SECFilingTarget> {
    for await (const chunk of readTargetsFromFile({
      filePath: targetsFile.filePath,
      batchSize: concurrency * 4,
    })) {
      for (const target of chunk) {
        yield target;
      }
    }
  }

  // Shared iterator — each worker pulls the next target as soon as it's free
  const iterator = allTargets();
  const pendingResults: ValidatedFiling[] = [];
  let sinkQueue: Promise<void> = Promise.resolve();

  function enqueueSinkBatch(batch: ValidatedFiling[]): Promise<void> {
    sinkQueue = sinkQueue.then(() => sinkBatch(batch, sinks, stats.sinkResults));
    return sinkQueue;
  }

  async function worker(): Promise<void> {
    for (;;) {
      const { value: target, done } = await iterator.next();
      if (done) break;

      limitedTargetCount += 1;
      const result = await parseSubsidiaryTarget(target, { fallbackPolicy });

      // Update stats
      stats.processed += 1;
      const status = result.parseResult?.status;
      if (status === "success") stats.successCount += 1;
      else if (status === "empty") stats.emptyCount += 1;
      else stats.failedCount += 1;

      pendingResults.push(result);

      // Flush to sinks when buffer is full
      if (
        !dryRun &&
        sinks.length > 0 &&
        pendingResults.length >= SINK_BATCH_SIZE
      ) {
        const batch = pendingResults.splice(0, pendingResults.length);
        await enqueueSinkBatch(batch);
      }

      const pct =
        totalToProcess > 0
          ? ((stats.processed / totalToProcess) * 100).toFixed(1)
          : "100.0";
      logger.info(`Progress: ${stats.processed}/${totalToProcess} (${pct}%)`);
    }
  }

  // Launch workers — each pulls from the shared iterator independently
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Flush remaining results
  if (!dryRun && sinks.length > 0 && pendingResults.length > 0) {
    const batch = pendingResults.splice(0, pendingResults.length);
    await enqueueSinkBatch(batch);
  }
  await sinkQueue;

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
    quarters: args.quarters,
    limit: args.limit,
    sp500Only: args.sp500Only,
    excludeSp500: args.excludeSp500,
    dryRun: args.dryRun,
    sinks: args.sinks as SubsidiarySinkName[],
    fallbackPolicy: args.fallbackPolicy,
    accessions: args.accessions,
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
