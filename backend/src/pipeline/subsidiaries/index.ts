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
    concurrency = 10,
    dryRun = false,
    sinks = [],
    outputDir,
  } = config;

  const cacheBaseDir = path.resolve(__dirname, "../../data_source/sec/output");

  const source = new CachedSECFilingsSource(
    { cacheBaseDir, exhibitTypes: ["EX-21", "EX-8"], year },
    filters
  );

  const pipeline = new Pipeline(source, {
    filters,
    steps,
    concurrency,
    dryRun,
    sinks,
    outputDir,
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
