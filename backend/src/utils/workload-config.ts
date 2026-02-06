/**
 * Workload Configuration Utility
 *
 * Provides helper presets for sizing concurrency/batch to common patterns.
 * Keep lightweight; callers can override as needed.
 */

export type WorkloadConfig = {
  concurrency: number;
  batchSize: number;
  reasoning?: string;
};

export const WORKLOAD_PRESETS = {
  fastIO: (taskCount: number): WorkloadConfig => ({
    concurrency: Math.min(16, Math.max(4, Math.ceil(taskCount / 500))),
    batchSize: Math.min(500, Math.max(50, Math.ceil(taskCount / 20))),
    reasoning: "I/O-light DB/cache work",
  }),

  download: (taskCount: number): WorkloadConfig => ({
    concurrency: Math.min(8, Math.max(2, Math.ceil(taskCount / 1000))),
    batchSize: Math.min(200, Math.max(20, Math.ceil(taskCount / 50))),
    reasoning: "Network/file downloads",
  }),

  secApi: (taskCount: number): WorkloadConfig => ({
    concurrency: 1, // SEC rate limit: keep single worker
    batchSize: Math.min(100, Math.max(20, Math.ceil(taskCount / 100))),
    reasoning: "SEC API ~10 req/s limit",
  }),
};
