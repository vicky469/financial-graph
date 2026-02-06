export type JobType = "index" | "data";
export type JobResult = "success" | "empty" | "failed";

export type JobFilters = {
  year?: number;
  quarter?: number;
  [key: string]: unknown;
};

export interface JobConfig {
  jobName: string;
  jobType: JobType;
  sourceUrl: string;
  startedAt: string;
  endedAt?: string;
  result?: JobResult;
  filters?: JobFilters;
}

export function createJobConfig(
  jobName: string,
  jobType: JobType,
  sourceUrl: string,
  filters?: JobFilters,
): JobConfig {
  return {
    jobName,
    jobType,
    sourceUrl,
    startedAt: new Date().toISOString(),
    filters,
  };
}

export function finalizeJobConfig(
  job: JobConfig,
  result: JobResult,
): JobConfig {
  return { ...job, result, endedAt: new Date().toISOString() };
}
