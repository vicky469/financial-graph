// ============================================================================
// Pipeline Configuration
// ============================================================================

/**
 * Configuration for pipeline behavior.
 * Controls filtering, step execution, and output.
 */
export interface PipelineConfig {
  // Filtering
  filters?: {
    sp500Only?: boolean;
    publicOnly?: boolean;
    limit?: number;
    ciks?: string[];
  };

  // Step control
  steps?: {
    skipValidation?: boolean;
    skipEnrichment?: boolean;
  };

  // Processing
  concurrency?: number;
  dryRun?: boolean;

  // LLM Worker Pool
  llmWorkers?: {
    maxWorkers?: number;
    maxRetries?: number;
    requestTimeout?: number;
  };

  // Output
  sinks?: string[];
  outputDir?: string;
}

// ============================================================================
// Metadata & Context
// ============================================================================

export interface ComputedMetadata {
  [key: string]: any;
}

export interface PipelineContext {
  config: PipelineConfig;
  metadata: ComputedMetadata;
  warnings: string[];
  debugInfo: Record<string, any>;
}

export interface PipelineResult {
  success: boolean;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  metadata: ComputedMetadata;
  sinkResults: Record<string, SinkResult>;
  timings: Record<string, number>;
  errors: PipelineError[];
}

// ============================================================================
// Error Handling
// ============================================================================

export type ErrorLevel = "source" | "filter" | "step" | "sink";

export interface PipelineError {
  level: ErrorLevel;
  stage: string; // e.g., "decompress", "sp500", "instantdb"
  itemId?: string; // e.g., accession number
  message: string;
  recoverable: boolean;
  error?: Error;
}

/**
 * Wrap an item with processing result
 */
export interface ProcessedItem<T> {
  item: T;
  success: boolean;
  error?: PipelineError;
}

// ============================================================================
// Source - Data Input
// ============================================================================

/**
 * Generic source that provides input data for pipelines.
 * Different pipelines can use the same source with different filters.
 */
export interface Source<T> {
  name: string;
  load(): Promise<T[]>;
}

// ============================================================================
// Filter - Data Reduction
// ============================================================================

/**
 * Filter that can be applied to source data.
 * Filters are composable and can be chained.
 */
export interface Filter<T> {
  name: string;
  apply(items: T[]): Promise<T[]> | T[];
}

/**
 * Compose multiple filters into a single filter.
 */
export function composeFilters<T>(...filters: Filter<T>[]): Filter<T> {
  return {
    name: filters.map((f) => f.name).join(" + "),
    async apply(items: T[]) {
      let result = items;
      for (const filter of filters) {
        result = await filter.apply(result);
      }
      return result;
    },
  };
}

// ============================================================================
// Sink - Data Output
// ============================================================================

/**
 * Generic sink that writes pipeline output.
 * Sinks can be composed (write to multiple destinations).
 */
export interface Sink<T> {
  name: string;
  write(items: T[]): Promise<SinkResult>;
}

export interface SinkResult {
  written: number;
  errors: number;
  details?: Record<string, any>;
}

/**
 * Compose multiple sinks to write to all of them.
 */
export function composeSinks<T>(...sinks: Sink<T>[]): Sink<T> {
  return {
    name: sinks.map((s) => s.name).join(" + "),
    async write(items: T[]) {
      const results = await Promise.all(sinks.map((s) => s.write(items)));
      return {
        written: results.reduce((sum, r) => sum + r.written, 0),
        errors: results.reduce((sum, r) => sum + r.errors, 0),
        details: Object.fromEntries(sinks.map((s, i) => [s.name, results[i]])),
      };
    },
  };
}

// ============================================================================
// Step - Data Transformation
// ============================================================================

/**
 * Represents a single atomic unit of work in the pipeline.
 */
export interface Step<TInput, TOutput> {
  name: string;
  execute: (
    input: TInput,
    context: PipelineContext
  ) => TOutput | Promise<TOutput>;
  canSkip?: (input: TInput, context: PipelineContext) => boolean;
}

/**
 * Represents a parallel execution block containing multiple steps.
 */
export interface ParallelStep<TInput, TOutput> {
  type: "parallel";
  name: string;
  steps: Step<TInput, any>[];
  merge: (results: any[], context: PipelineContext) => TOutput;
}

export type PipelineOperation<TInput, TOutput> =
  | Step<TInput, TOutput>
  | ParallelStep<TInput, TOutput>;
