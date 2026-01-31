/**
 * Job Configuration Types
 *
 * Types for the job configuration and execution system
 */

import type { InstaQLEntity } from "@instantdb/core";
import type schema from "../instant.schema";

// ============================================================================
// ENUMS
// ============================================================================

export const JobScheduleType = {
  MANUAL: "manual",
  CRON: "cron",
  INTERVAL: "interval",
} as const;

export type JobScheduleTypeValue =
  (typeof JobScheduleType)[keyof typeof JobScheduleType];

export const JobExecutionStatus = {
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type JobExecutionStatusValue =
  (typeof JobExecutionStatus)[keyof typeof JobExecutionStatus];

export const JobTriggerType = {
  MANUAL: "manual",
  SCHEDULED: "scheduled",
  DEPENDENCY: "dependency",
} as const;

export type JobTriggerTypeValue =
  (typeof JobTriggerType)[keyof typeof JobTriggerType];

// Source and destination types are flexible - any string is allowed
// No type aliases needed - just use string directly

// ============================================================================
// RAW TYPES (from InstantDB)
// ============================================================================

export type JobConfigRaw = InstaQLEntity<typeof schema, "job_config">;
export type JobSourceRaw = InstaQLEntity<typeof schema, "job_source">;
export type JobDestinationRaw = InstaQLEntity<typeof schema, "job_destination">;
export type JobExecutionRaw = InstaQLEntity<typeof schema, "job_execution">;
export type JobDependencyRaw = InstaQLEntity<typeof schema, "job_dependency">;

// ============================================================================
// JOB CONFIGURATION INTERFACES
// ============================================================================

/** Job schedule configuration */
export interface JobSchedule {
  type: JobScheduleTypeValue;
  cronExpression?: string;
  intervalMinutes?: number;
}

/** Filter condition for job sources */
export interface FilterCondition {
  field: string;
  operator:
    | "equals"
    | "contains"
    | "starts_with"
    | "greater_than"
    | "less_than"
    | "in"
    | "not_in";
  value: string | number | boolean | string[] | number[];
  caseSensitive?: boolean;
}

/** Source validation rules */
export interface SourceValidation {
  required: boolean;
  minRecords?: number;
}

/** Destination transformation configuration */
export interface DestinationTransformation {
  fieldMapping?: Record<string, string>;
  filters?: string[];
  aggregations?: string[];
}

/** Job execution configuration */
export interface JobExecutionConfig {
  timeoutMinutes: number;
  retryAttempts: number;
  notifyOnFailure: boolean;
  notifyEmails: string[];
}

/** Job source with properly typed fields */
export interface JobSource extends Omit<
  JobSourceRaw,
  "parameters" | "filters"
> {
  parameters: Record<string, any>;
  filters?: FilterCondition[];
}

/** Job destination with properly typed fields */
export interface JobDestination extends Omit<JobDestinationRaw, "parameters"> {
  parameters: Record<string, any>;
}

/** Job execution with properly typed fields */
export interface JobExecution extends Omit<
  JobExecutionRaw,
  "status" | "trigger_type" | "execution_metadata"
> {
  status: JobExecutionStatusValue;
  trigger_type: JobTriggerTypeValue;
  execution_metadata?: Record<string, any>;
}

/** Job configuration with properly typed fields */
export interface JobConfiguration extends Omit<JobConfigRaw, "schedule_type"> {
  schedule_type: JobScheduleTypeValue;
  // Computed fields from relationships
  sources?: JobSource[];
  destinations?: JobDestination[];
  executions?: JobExecution[];
  dependencies?: JobConfiguration[];
  dependents?: JobConfiguration[];
  creator?: {
    id: string;
    email?: string;
  };
}
