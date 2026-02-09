/**
 * Shared concurrency defaults for batch jobs.
 */

export function getDefaultConcurrency(limit?: number): {
  job: number;
  llmWorkers: number;
} {
  if (limit && limit <= 50) {
    return { job: 5, llmWorkers: 8 };
  }

  if (limit && limit <= 500) {
    return { job: 10, llmWorkers: 15 };
  }

  return { job: 15, llmWorkers: 20 };
}
