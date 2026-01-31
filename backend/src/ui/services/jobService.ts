/**
 * Service layer for job-related API calls
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Toggle job enabled/disabled state
 */
export async function toggleJob(
  jobId: string,
  enabled: boolean
): Promise<ApiResponse> {
  const response = await fetch(`/api/jobs/${jobId}/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return { success: true };
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<ApiResponse> {
  const response = await fetch(`/api/jobs/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return { success: true };
}

/**
 * Execute a job manually
 */
export async function executeJob(
  jobId: string
): Promise<ApiResponse<{ execution: { id: string } }>> {
  const response = await fetch(`/api/jobs/${jobId}/execute`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return { success: true, data };
}

/**
 * Stop a running job execution
 */
export async function stopJob(
  jobId: string,
  executionId: string
): Promise<ApiResponse> {
  const response = await fetch(
    `/api/jobs/${jobId}/executions/${executionId}/stop`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return { success: true };
}

/**
 * Create a new job
 */
export async function createJob(jobData: any): Promise<ApiResponse> {
  console.log('[Job POST] Payload:', JSON.stringify(jobData, null, 2));

  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return { success: true };
}

/**
 * Update an existing job
 */
export async function updateJob(
  jobId: string,
  jobData: any
): Promise<ApiResponse> {
  console.log('[Job PUT] Job ID:', jobId);
  console.log('[Job PUT] Payload:', JSON.stringify(jobData, null, 2));

  const response = await fetch(`/api/jobs/${jobId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobData),
  });

  console.log('[Job PUT] Response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Job PUT] Error response:', errorData);
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  console.log('[Job PUT] Success response:', result);
  return { success: true };
}
