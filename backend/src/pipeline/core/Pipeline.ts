import {
  PipelineConfig,
  PipelineContext,
  PipelineResult,
  PipelineOperation,
  PipelineError,
  Step,
  ParallelStep,
  Source,
  Filter,
  Sink,
  SinkResult,
} from "./types";
import { createLogger } from "../../utils/logger";

const logger = createLogger("pipeline/core");

/**
 * Pipeline Engine
 *
 * Executes a data processing pipeline with the flow:
 * Source → Filters → Steps → Sinks
 *
 * Error Handling:
 * - Source errors: Fatal, pipeline stops
 * - Filter errors: Fatal, pipeline stops
 * - Step errors: Per-item, continues with other items
 * - Sink errors: Logged, continues with other sinks
 */
export class Pipeline<TSource, TOutput = TSource> {
  private source: Source<TSource>;
  private config: PipelineConfig;
  private filters: Filter<TSource>[] = [];
  private steps: PipelineOperation<any, any>[] = [];
  private sinks: Sink<TOutput>[] = [];
  private context: PipelineContext;
  private errors: PipelineError[] = [];
  private timings: Record<string, number> = {};

  constructor(source: Source<TSource>, config: PipelineConfig = {}) {
    this.source = source;
    this.config = {
      concurrency: 10,
      dryRun: false,
      ...config,
    };
    this.context = {
      config: this.config,
      metadata: {},
      warnings: [],
      debugInfo: {},
    };
  }

  getConfig(): PipelineConfig {
    return this.config;
  }

  filter(filter: Filter<TSource>): this {
    this.filters.push(filter);
    return this;
  }

  use<TInput, TOut>(step: Step<TInput, TOut>): Pipeline<TSource, TOut> {
    this.steps.push(step);
    return this as unknown as Pipeline<TSource, TOut>;
  }

  parallel<TInput, TOut>(
    name: string,
    steps: Step<TInput, any>[],
    merge: (results: any[], context: PipelineContext) => TOut
  ): Pipeline<TSource, TOut> {
    this.steps.push({ type: "parallel", name, steps, merge });
    return this as unknown as Pipeline<TSource, TOut>;
  }

  sink(sink: Sink<TOutput>): this {
    this.sinks.push(sink);
    return this;
  }

  // ===========================================================================
  // EXECUTE - Main entry point
  // ===========================================================================

  async execute(): Promise<PipelineResult> {
    this.errors = [];
    this.timings = {};

    logger.info(`Pipeline: ${this.source.name}`);

    const items = await this.loadSource();
    if (!items) return this.buildResult([], {});

    // Stage 2: Apply filters
    const filtered = await this.applyFilters(items);
    if (!filtered) return this.buildResult([], {});

    // Stage 3 & 4: Process and sink in batches
    const { processResults, sinkResults } = await this.processAndSinkInBatches(filtered);

    // Summary
    this.logSummary();

    return this.buildResult(processResults, sinkResults);
  }

  // ===========================================================================
  // STAGE 1: Load Source
  // ===========================================================================

  private async loadSource(): Promise<TSource[] | null> {
    try {
      const start = Date.now();
      const items = await this.source.load();
      this.timings["source.load"] = Date.now() - start;

      logger.info(`Loaded ${items.length} items (${this.timings["source.load"]}ms)`);

      return items;
    } catch (error) {
      this.addError("source", this.source.name, null, error, false);
      return null;
    }
  }

  // ===========================================================================
  // STAGE 2: Apply Filters
  // ===========================================================================

  private async applyFilters(items: TSource[]): Promise<TSource[] | null> {
    if (this.filters.length === 0) {
      return items;
    }

    console.log(`\n🔍 Stage 2: Apply filters`);

    let filtered = items;

    for (const filter of this.filters) {
      try {
        const start = Date.now();
        filtered = await filter.apply(filtered);
        this.timings[`filter.${filter.name}`] = Date.now() - start;

        console.log(`   ✓ ${filter.name}: ${filtered.length} items (${this.timings[`filter.${filter.name}`]}ms)`);
        logger.info(`After ${filter.name}: ${filtered.length} items`);
      } catch (error) {
        console.log(`   ✗ Filter ${filter.name} failed`);
        this.addError("filter", filter.name, null, error, false);
        return null;
      }
    }

    return filtered;
  }

  // ===========================================================================
  // STAGE 3 & 4: Process and Sink in Batches (Memory Optimized)
  // ===========================================================================

  private async processAndSinkInBatches(items: TSource[]): Promise<{
    processResults: (TOutput | null)[],
    sinkResults: Record<string, SinkResult>
  }> {
    console.log(`\n⚙️  Stage 3 & 4: Process and sink in batches`);
    this.steps.forEach((step, i) => console.log(`   ${i + 1}. ${step.name}`));

    const start = Date.now();
    let successCount = 0, emptyCount = 0, failedCount = 0;
    const processResults: (TOutput | null)[] = [];

    // Initialize sink results
    const sinkResults: Record<string, SinkResult> = {};
    for (const sink of this.sinks) {
      sinkResults[sink.name] = { written: 0, errors: 0, details: {} };
    }

    const PROCESS_BATCH_SIZE = this.config.concurrency || 10;
    const SINK_BATCH_SIZE = 20;

    // Process items in batches
    for (let i = 0; i < items.length; i += PROCESS_BATCH_SIZE) {
      const batch = items.slice(i, i + PROCESS_BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(item => this.processItemSafe(item))
      );
      
      processResults.push(...batchResults);
      
      // Count results for summary
      for (const result of batchResults) {
        if (result) {
          const parseStatus = (result as any).parseResult?.status;
          if (parseStatus === "success") successCount++;
          else if (parseStatus === "empty") emptyCount++;
        } else {
          failedCount++;
        }
      }

      // Sink successful results immediately (if not dry run and have sinks)
      const succeededInBatch = batchResults.filter(r => r !== null) as TOutput[];
      if (!this.config.dryRun && this.sinks.length > 0 && succeededInBatch.length > 0) {
        await this.sinkBatch(succeededInBatch, sinkResults, SINK_BATCH_SIZE);
      }

      // Progress
      const processed = Math.min(i + PROCESS_BATCH_SIZE, items.length);
      logger.info(`Progress: ${processed}/${items.length} (${((processed / items.length) * 100).toFixed(1)}%)`);
    }

    this.timings["process_and_sink.total"] = Date.now() - start;

    // Summary
    const total = processResults.length;
    const successPct = ((successCount / total) * 100).toFixed(1);
    const emptyPct = ((emptyCount / total) * 100).toFixed(1);
    const failedPct = ((failedCount / total) * 100).toFixed(1);
    
    console.log(`   ✓ ${total} processed: ${successCount} success (${successPct}%), ${emptyCount} empty (${emptyPct}%), ${failedCount} failed (${failedPct}%) (${this.timings["process_and_sink.total"]}ms)`);

    // Handle dry run case
    if (this.config.dryRun) {
      console.log(`\n🔸 Dry run - skipped sinks`);
    } else if (this.sinks.length === 0) {
      console.log(`\n📤 No sinks configured`);
    } else {
      // Final totals
      console.log(`\n📤 Final sink totals:`);
      for (const sink of this.sinks) {
        console.log(`   ${sink.name}: ${sinkResults[sink.name].written} written, ${sinkResults[sink.name].errors} errors`);
      }
    }

    // Store for buildResult
    this.context.metadata = { 
      itemsWithSubsidiaries: successCount, 
      itemsEmpty: emptyCount, 
      itemsFailed: failedCount
    };

    return { processResults, sinkResults };
  }

  // ===========================================================================
  // SINK BATCH HELPER
  // ===========================================================================

  private async sinkBatch(
    results: TOutput[], 
    sinkResults: Record<string, SinkResult>, 
    batchSize: number
  ): Promise<void> {
    // Sink in smaller batches if needed
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      for (const sink of this.sinks) {
        try {
          const start = Date.now();
          const batchResult = await sink.write(batch);
          const time = Date.now() - start;
          
          sinkResults[sink.name].written += batchResult.written;
          sinkResults[sink.name].errors += batchResult.errors;
          
          if (batchResult.details) {
            Object.assign(sinkResults[sink.name].details || {}, batchResult.details);
          }
          
          console.log(`   ✓ ${sink.name}: +${batchResult.written} (${time}ms)`);
        } catch (error) {
          console.log(`   ✗ ${sink.name}: batch failed`);
          this.addError("sink", sink.name, null, error, true);
          sinkResults[sink.name].errors += batch.length;
        }
      }
    }
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  private logSummary(): void {
    if (this.errors.length > 0) {
      logger.warn(`Pipeline completed with ${this.errors.length} errors`);
      this.errors.slice(0, 3).forEach((e) => {
        logger.error(`[${e.level}:${e.stage}] ${e.message}`);
      });
    }
  }

  // ===========================================================================
  // ITEM PROCESSING
  // ===========================================================================

  private async processItems(items: TSource[]): Promise<(TOutput | null)[]> {
    const results: (TOutput | null)[] = [];
    const concurrency = this.config.concurrency || 10;

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((item) => this.processItemSafe(item))
      );

      results.push(...batchResults);

      // Progress logging
      if ((i + concurrency) % 100 === 0 || i + concurrency >= items.length) {
        const processed = Math.min(i + concurrency, items.length);
        logger.info(
          `Progress: ${processed}/${items.length} (${((processed / items.length) * 100).toFixed(1)}%)`
        );
      }
    }

    return results;
  }

  private async processItemSafe(item: TSource): Promise<TOutput | null> {
    try {
      return await this.processItem(item);
    } catch (error) {
      const itemId = this.getItemId(item);
      this.addError("step", "processing", itemId, error, true);
      return null;
    }
  }

  private async processItem(item: TSource): Promise<TOutput> {
    let currentData: any = item;

    for (const step of this.steps) {
      try {
        if (this.isParallel(step)) {
          currentData = await this.executeParallel(step, currentData);
        } else {
          currentData = await this.executeSequential(step, currentData);
        }
      } catch (error) {
        const itemId = this.getItemId(item);
        this.addError("step", step.name, itemId, error, true);
        throw error;
      }
    }

    return currentData as TOutput;
  }

  private isParallel(step: PipelineOperation<any, any>): step is ParallelStep<any, any> {
    return "type" in step && step.type === "parallel";
  }

  private async executeSequential(step: Step<any, any>, input: any): Promise<any> {
    if (step.canSkip && step.canSkip(input, this.context)) {
      return input;
    }
    return await step.execute(input, this.context);
  }

  private async executeParallel(parallel: ParallelStep<any, any>, input: any): Promise<any> {
    const promises = parallel.steps.map(async (step) => {
      if (step.canSkip && step.canSkip(input, this.context)) {
        return null;
      }
      return await step.execute(input, this.context);
    });

    const results = await Promise.all(promises);
    return parallel.merge(results, this.context);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private addError(
    level: PipelineError["level"],
    stage: string,
    itemId: string | null,
    error: unknown,
    recoverable: boolean
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    this.errors.push({
      level,
      stage,
      itemId: itemId || undefined,
      message,
      recoverable,
      error: error instanceof Error ? error : undefined,
    });
  }

  private getItemId(item: TSource): string {
    const obj = item as any;
    return obj.accessionNumber || obj.id || obj.name || "unknown";
  }

  private buildResult(
    results: (TOutput | null)[],
    sinkResults: Record<string, SinkResult>
  ): PipelineResult {
    const hasFatalError = this.errors.some((e) => !e.recoverable);

    // Use metadata from batch processing
    const itemsWithSubsidiaries = this.context.metadata.itemsWithSubsidiaries || 0;
    const itemsEmpty = this.context.metadata.itemsEmpty || 0;
    const itemsFailed = this.context.metadata.itemsFailed || 0;
    const totalProcessed = itemsWithSubsidiaries + itemsEmpty + itemsFailed;

    return {
      success: !hasFatalError && this.errors.length === 0,
      itemsProcessed: totalProcessed,
      itemsSucceeded: itemsWithSubsidiaries + itemsEmpty, // Both success and empty are "succeeded"
      itemsFailed: itemsFailed,
      metadata: this.context.metadata,
      sinkResults,
      timings: this.timings,
      errors: this.errors,
    };
  }

  getContext(): PipelineContext {
    return this.context;
  }
}
