import { Job, JobStatus, TypeOption } from '../types/job.types';

/**
 * Determines the status of a job based on its enabled state and latest execution
 */
export function getJobStatus(job: Job): JobStatus {
  if (!job.enabled) {
    return { text: 'Disabled', icon: '⚪', class: 'status-disabled' };
  }
  
  const latestExecution = job.executions?.[0];
  if (!latestExecution) {
    return { text: 'Never run', icon: '❓', class: 'status-disabled' };
  }
  
  switch (latestExecution.status) {
    case 'running':
      return { text: 'Running', icon: '🟡', class: 'status-running' };
    case 'completed':
      return { text: 'Completed', icon: '🟢', class: 'status-enabled' };
    case 'failed':
      return { text: 'Failed', icon: '🔴', class: 'status-failed' };
    default:
      return { text: 'Unknown', icon: '❓', class: 'status-disabled' };
  }
}

/**
 * Computes a job name from source type, year, quarter, month, and day
 */
export function computeSourceName(
  type: string,
  year: string,
  quarter: string,
  month: string,
  day: string,
  sourceTypes: TypeOption[]
): string {
  const typeLabel = sourceTypes.find(t => t.value === type)?.label || type;
  const typePart = typeLabel.toLowerCase().replace(/\s+/g, '-');
  const parts = [typePart];
  if (year) parts.push(year);
  if (quarter) parts.push(`q${quarter}`);
  if (month) parts.push(month);
  if (day) parts.push(day);
  return parts.join('_');
}

/**
 * Formats the last successful execution time
 */
export function getLastSuccessTime(job: Job): string {
  const lastSuccessfulExecution = job.executions?.find(
    (e) => e.status === 'completed'
  );
  return lastSuccessfulExecution
    ? new Date(lastSuccessfulExecution.completed_at!).toLocaleString()
    : 'Never';
}
