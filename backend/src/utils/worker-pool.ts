/**
 * Worker Pool Utility
 *
 * A simple, reusable worker pool for concurrent task processing.
 * Follows industry best practices:
 * - Generic type support for type safety
 * - Configurable concurrency
 * - Progress callbacks for monitoring
 * - Error handling with optional error collection
 * - Graceful shutdown on completion
 */

export type WorkerPoolOptions<T, R> = {
  concurrency: number;
  tasks: T[];
  worker: (task: T, workerId: number) => Promise<R>;
  onProgress?: (stats: ProgressStats) => void;
  progressInterval?: number;
};

export type ProgressStats = {
  completed: number;
  failed: number;
  remaining: number;
  total: number;
};

export type WorkerPoolResult<R> = {
  results: R[];
  errors: Array<{ task: unknown; error: Error }>;
  stats: ProgressStats;
};

/**
 * Execute tasks concurrently using a worker pool pattern.
 *
 * @example
 * ```ts
 * const result = await runWorkerPool({
 *   concurrency: 4,
 *   tasks: filings,
 *   worker: async (filing, workerId) => {
 *     const body = await downloadFiling(filing);
 *     return { id: filing.id, body };
 *   },
 *   onProgress: (stats) => {
 *     logger.info(`Progress: ${stats.completed}/${stats.total}`);
 *   },
 * });
 * ```
 */
export async function runWorkerPool<T, R>(
  options: WorkerPoolOptions<T, R>,
): Promise<WorkerPoolResult<R>> {
  const {
    concurrency,
    tasks,
    worker,
    onProgress,
    progressInterval = 50,
  } = options;

  const queue = [...tasks];
  const results: R[] = [];
  const errors: Array<{ task: T; error: Error }> = [];
  let completed = 0;
  let failed = 0;

  const stats = (): ProgressStats => ({
    completed,
    failed,
    remaining: queue.length,
    total: tasks.length,
  });

  const workerFn = async (workerId: number) => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      try {
        const result = await worker(task, workerId);
        results.push(result);
        completed += 1;

        if (onProgress && completed % progressInterval === 0) {
          onProgress(stats());
        }
      } catch (error) {
        failed += 1;
        errors.push({
          task,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: concurrency }, (_, i) => workerFn(i)),
  );

  if (onProgress) {
    onProgress(stats());
  }

  return {
    results,
    errors,
    stats: stats(),
  };
}

/**
 * Simplified worker pool for tasks that don't return results.
 * Useful for side-effect operations like downloads or updates.
 */
export async function runWorkerPoolVoid<T>(
  options: Omit<WorkerPoolOptions<T, void>, "worker"> & {
    worker: (task: T, workerId: number) => Promise<void>;
  },
): Promise<Omit<WorkerPoolResult<void>, "results">> {
  const result = await runWorkerPool(options);
  return {
    errors: result.errors,
    stats: result.stats,
  };
}
