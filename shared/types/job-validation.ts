/**
 * Job Configuration Validation Schemas
 * 
 * Zod schemas for validating job configuration data
 */

import { z } from "zod";
import { JobScheduleType } from "./jobs";
import { NonEmptyString } from "./domain-validation";

// ============================================================================
// JOB VALIDATION SCHEMAS
// ============================================================================

/** Cron expression validation (basic format check) */
export const CronExpressionSchema = z.string().regex(
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
  "Invalid cron expression format"
);

/** Job schedule validation */
export const JobScheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(JobScheduleType.MANUAL),
  }),
  z.object({
    type: z.literal(JobScheduleType.CRON),
    cronExpression: CronExpressionSchema,
  }),
  z.object({
    type: z.literal(JobScheduleType.INTERVAL),
    intervalMinutes: z.number().int().min(1).max(10080), // 1 minute to 1 week
  }),
]);

/** Filter condition validation */
export const FilterConditionSchema = z.object({
  field: z.enum(['limit', 'sp500', 'type', 'name', 'cik', 'ticker', 'filing_date', 'form_type']).or(NonEmptyString),
  operator: z.enum(['equals', 'contains', 'starts_with', 'greater_than', 'less_than', 'in', 'not_in']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
  caseSensitive: z.boolean().optional(),
});

/** Source validation rules */
export const SourceValidationSchema = z.object({
  required: z.boolean(),
  minRecords: z.number().int().min(0).optional(),
  maxAge: z.number().int().min(1).optional(),
});

/** Job source validation */
export const JobSourceSchema = z.object({
  parameters: z.record(z.string(), z.any()),
  filters: z.array(FilterConditionSchema).optional(),
  order_index: z.number().int().min(0),
});

/** Job destination validation */
export const JobDestinationSchema = z.object({
  parameters: z.record(z.string(), z.any()),
  order_index: z.number().int().min(0),
});

/** Job execution configuration validation */
export const JobExecutionConfigSchema = z.object({
  timeoutMinutes: z.number().int().min(1).max(1440), // 1 minute to 24 hours
  retryAttempts: z.number().int().min(0).max(10),
  notifyOnFailure: z.boolean(),
  notifyEmails: z.array(z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")).optional(),
});

/** Job configuration validation */
export const JobConfigurationSchema = z.object({
  name: z.string().min(1, 'Job name is required'),
  description: z.string().optional(),
  job_type: z.string().min(1, 'Job type is required'),
  enabled: z.boolean(),
  schedule_type: z.enum(['manual', 'cron', 'interval']),
  cron_expression: CronExpressionSchema.optional(),
  interval_minutes: z.number().int().min(1).max(10080).optional(), // 1 minute to 1 week
  created_by: z.string().min(1, 'Created by is required'),
}).refine((data) => {
  // Validate schedule-specific fields
  if (data.schedule_type === JobScheduleType.CRON && !data.cron_expression) {
    return false;
  }
  if (data.schedule_type === JobScheduleType.INTERVAL && !data.interval_minutes) {
    return false;
  }
  return true;
}, {
  message: "Cron schedule requires a cron expression, interval schedule requires interval minutes",
});
