/**
 * Subsidiaries Pipeline Factory
 *
 * Creates subsidiaries extraction pipelines.
 * The factory shows exactly what the pipeline does.
 *
 * Usage:
 * ```typescript
 * const pipeline = createSubsidiariesPipeline({
 *   filters: { sp500Only: true, limit: 10 },
 *   steps: { skipValidation: false },
 *   sinks: ['db', 'excel']
 * });
 *
 * await pipeline.execute();
 * ```
 */

import path from "path";
import { Pipeline } from "../core/Pipeline";
import { PipelineConfig } from "../core/types";
import { CachedSECFilingsSource } from "../sources/cached-sec-filings";
import { LimitFilter } from "../sources/filters";
import { decompressStep, parseStep, validateStep } from "./steps";
import { SubsidiariesDBSink, SubsidiariesExcelSink } from "./sinks";

export interface SubsidiariesPipelineConfig extends PipelineConfig {
  year?: number;
}

/**
 * Get default concurrency settings based on common use cases
 */
function getDefaultConcurrency(config: SubsidiariesPipelineConfig): {
  pipeline: number;
  llmWorkers: number;
} {
  // Small batch processing (< 50 items)
  if (config.filters?.limit && config.filters.limit <= 50) {
    return { pipeline: 5, llmWorkers: 8 };  // 5 filings at once, 8 LLM workers for bursts
  }
  
  // Medium batch processing (50-500 items)  
  if (config.filters?.limit && config.filters.limit <= 500) {
    return { pipeline: 10, llmWorkers: 15 }; // 10 filings at once, 15 LLM workers
  }
  
  // Large batch processing (> 500 items or no limit)
  // Full year processing: ~8000-12000 filings
  return { pipeline: 15, llmWorkers: 20 }; // 15 filings at once, 20 LLM workers (API limit)
}

/**
 * Create a subsidiaries extraction pipeline.
 *
 * Flow: Source → Filter → Steps → Sinks
 */
export function createSubsidiariesPipeline(
  config: SubsidiariesPipelineConfig = {}
) {
  const {
    year = parseInt(process.env.SEC_YEARS!),
    filters = {},
    steps = {},
    dryRun = false,
    sinks = [],
    outputDir,
    llmWorkers = {},
  } = config;

  // Simple, clean concurrency defaults based on common use cases
  const defaultConcurrency = getDefaultConcurrency(config);
  const pipelineConcurrency = config.concurrency || defaultConcurrency.pipeline;

  // LLM workers coordinated with pipeline concurrency
  const workerPoolConfig = {
    maxWorkers: llmWorkers.maxWorkers || defaultConcurrency.llmWorkers,
    maxRetries: llmWorkers.maxRetries || 3,
    requestTimeout: llmWorkers.requestTimeout || 30000,
  };

  console.log(`⚙️  Pipeline: ${pipelineConcurrency} concurrent filings`);
  console.log(`🤖 LLM Pool: ${workerPoolConfig.maxWorkers} workers (${(workerPoolConfig.maxWorkers/pipelineConcurrency).toFixed(1)}x ratio)`);

  const cacheBaseDir = path.resolve(__dirname, "../../data_source/sec/output");

  const source = new CachedSECFilingsSource(
    { cacheBaseDir, exhibitTypes: ["EX-21", "EX-8"], year },
    filters
  );

  const pipeline = new Pipeline(source, {
    filters,
    steps,
    concurrency: pipelineConcurrency,
    dryRun,
    sinks,
    outputDir,
    llmWorkers: workerPoolConfig,
  });

  // Filter
  if (filters.limit) {
    pipeline.filter(new LimitFilter(filters.limit));
  }

  // Steps
  pipeline
    .use(decompressStep)
    .use(parseStep);

  if (!steps.skipValidation) {
    pipeline.use(validateStep);
  }

  // Sinks
  if (sinks.includes("db")) {
    pipeline.sink(new SubsidiariesDBSink());
  }
  if (sinks.includes("excel")) {
    pipeline.sink(new SubsidiariesExcelSink(outputDir));
  }

  return pipeline;
}

// Exports
export * from "./types";
export * from "./steps";
export * from "./sinks";
