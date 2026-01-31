/**
 * Job Configuration Query Definitions
 *
 * Reusable query definitions for job management.
 * Can be used with db.useQuery() (frontend) or db.queryOnce() (backend).
 */

import type { JobConfiguration, JobExecution } from '../../types';

/**
 * Query definition: Get all job configurations with their latest execution
 */
export const allJobsQuery = {
  job_config: {
    $: {
      order: { created_at: 'desc' },
    },
    sources: {
      $: {
        order: { order_index: 'asc' },
      },
    },
    destinations: {
      $: {
        order: { order_index: 'asc' },
      },
    },
    executions: {
      $: {
        order: { started_at: 'desc' },
        limit: 1, // Only get the latest execution
      },
    },
    creator: {},
  },
} as const;

/**
 * Query definition: Get a specific job configuration with full details
 */
export function jobDetailsQuery(jobId: string) {
  return {
    job_config: {
      $: {
        where: { id: jobId },
      },
      sources: {
        $: {
          order: { order_index: 'asc' },
        },
      },
      destinations: {
        $: {
          order: { order_index: 'asc' },
        },
      },
      executions: {
        $: {
          order: { started_at: 'desc' },
          limit: 10, // Get recent executions
        },
      },
      dependencies: {
        prerequisiteJob: {},
      },
      dependents: {
        dependentJob: {},
      },
      creator: {},
    },
  };
}

/**
 * Query definition: Get job executions for a specific job
 */
export function jobExecutionsQuery(jobId: string, limit: number = 20) {
  return {
    job_execution: {
      $: {
        where: { job: { id: jobId } },
        order: { started_at: 'desc' },
        limit,
      },
      job: {},
    },
  };
}

/**
 * Query definition: Get recent job executions across all jobs
 */
export function recentExecutionsQuery(limit: number = 50) {
  return {
    job_execution: {
      $: {
        order: { started_at: 'desc' },
        limit,
      },
      job: {},
    },
  };
}

/**
 * Query definition: Get jobs by status (enabled/disabled)
 */
export function jobsByStatusQuery(enabled: boolean) {
  return {
    job_config: {
      $: {
        where: { enabled },
        order: { created_at: 'desc' },
      },
      sources: {
        $: {
          order: { order_index: 'asc' },
        },
      },
      destinations: {
        $: {
          order: { order_index: 'asc' },
        },
      },
      executions: {
        $: {
          order: { started_at: 'desc' },
          limit: 1,
        },
      },
      creator: {},
    },
  };
}

/**
 * Query definition: Get jobs by schedule type
 */
export function jobsByScheduleTypeQuery(scheduleType: string) {
  return {
    job_config: {
      $: {
        where: { schedule_type: scheduleType },
        order: { created_at: 'desc' },
      },
      sources: {
        $: {
          order: { order_index: 'asc' },
        },
      },
      destinations: {
        $: {
          order: { order_index: 'asc' },
        },
      },
      executions: {
        $: {
          order: { started_at: 'desc' },
          limit: 1,
        },
      },
      creator: {},
    },
  };
}

/**
 * Helper: Extract job configurations from query result
 */
export function extractJobConfigurations(result: any): JobConfiguration[] {
  if (!result?.job_config) return [];
  
  return result.job_config.map((job: any) => ({
    id: job.id,
    name: job.name,
    description: job.description,
    job_type: job.job_type,
    enabled: job.enabled,
    schedule_type: job.schedule_type,
    cron_expression: job.cron_expression,
    created_at: job.created_at,
    updated_at: job.updated_at,
    created_by: job.created_by,
    sources: (job.sources || []).map((source: any) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      parameters: source.parameters,
      filters: source.filters,
      validation: source.validation,
      order_index: source.order_index,
      created_at: source.created_at,
      updated_at: source.updated_at,
    })),
    destinations: (job.destinations || []).map((dest: any) => ({
      id: dest.id,
      name: dest.name,
      type: dest.type,
      parameters: dest.parameters,
      transformation: dest.transformation,
      order_index: dest.order_index,
      created_at: dest.created_at,
      updated_at: dest.updated_at,
    })),
    executions: (job.executions || []).map((exec: any) => ({
      id: exec.id,
      status: exec.status,
      trigger_type: exec.trigger_type,
      started_at: exec.started_at,
      completed_at: exec.completed_at,
      items_processed: exec.items_processed,
      items_succeeded: exec.items_succeeded,
      items_failed: exec.items_failed,
      error_message: exec.error_message,
      temporal_workflow_id: exec.temporal_workflow_id,
      temporal_run_id: exec.temporal_run_id,
      execution_metadata: exec.execution_metadata,
    })),
    dependencies: (job.dependencies || []).map((dep: any) => dep.prerequisiteJob),
    dependents: (job.dependents || []).map((dep: any) => dep.dependentJob),
    creator: job.creator,
  }));
}

/**
 * Helper: Extract job executions from query result
 */
export function extractJobExecutions(result: any): JobExecution[] {
  if (!result?.job_execution) return [];
  
  return result.job_execution.map((exec: any) => ({
    id: exec.id,
    status: exec.status,
    trigger_type: exec.trigger_type,
    started_at: exec.started_at,
    completed_at: exec.completed_at,
    items_processed: exec.items_processed,
    items_succeeded: exec.items_succeeded,
    items_failed: exec.items_failed,
    error_message: exec.error_message,
    temporal_workflow_id: exec.temporal_workflow_id,
    temporal_run_id: exec.temporal_run_id,
    execution_metadata: exec.execution_metadata,
  }));
}

/**
 * Helper: Get job status display info
 */
export function getJobStatusInfo(job: JobConfiguration): {
  status: 'never-run' | 'running' | 'completed' | 'failed' | 'disabled';
  statusText: string;
  statusIcon: string;
  lastRun?: string;
} {
  if (!job.enabled) {
    return {
      status: 'disabled',
      statusText: 'Disabled',
      statusIcon: '⚪',
    };
  }
  
  const latestExecution = job.executions?.[0];
  if (!latestExecution) {
    return {
      status: 'never-run',
      statusText: 'Never run',
      statusIcon: '❓',
    };
  }
  
  const lastRun = formatTimeAgo(latestExecution.started_at);
  
  switch (latestExecution.status) {
    case 'running':
      return {
        status: 'running',
        statusText: 'Running',
        statusIcon: '🟡',
        lastRun: `Started ${lastRun}`,
      };
    case 'completed':
      return {
        status: 'completed',
        statusText: 'Completed',
        statusIcon: '🟢',
        lastRun: `Completed ${lastRun}`,
      };
    case 'failed':
      return {
        status: 'failed',
        statusText: 'Failed',
        statusIcon: '🔴',
        lastRun: `Failed ${lastRun}`,
      };
    default:
      return {
        status: 'never-run',
        statusText: 'Unknown',
        statusIcon: '❓',
        lastRun,
      };
  }
}

/**
 * Helper: Get schedule display text
 */
export function getScheduleDisplayText(job: JobConfiguration): string {
  switch (job.schedule_type) {
    case 'manual':
      return 'Manual';
    case 'cron':
      return job.cron_expression ? `Cron: ${job.cron_expression}` : 'Invalid cron';
    default:
      return 'Unknown';
  }
}

/**
 * Helper: Format time ago (simple implementation)
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}