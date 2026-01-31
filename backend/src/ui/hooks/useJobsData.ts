import { init } from '@instantdb/react';

// Initialize InstantDB
const db = init({
  appId: '2ed56b09-a3ed-49d8-984d-94723a57070c',
});

// Job query definition
const jobsQuery = {
  job_config: {
    $: {
      order: { created_at: 'desc' as const },
    },
    sources: {
      $: {
        order: { order_index: 'asc' as const },
      },
    },
    destinations: {
      $: {
        order: { order_index: 'asc' as const },
      },
    },
    executions: {
      $: {
        order: { started_at: 'desc' as const },
        limit: 1, // Only get the latest execution
      },
    },
    creator: {},
  },
};

/**
 * Hook to fetch jobs data from InstantDB
 */
export function useJobsData() {
  const { isLoading, error, data } = db.useQuery(jobsQuery);
  const jobs = data?.job_config || [];

  return {
    jobs,
    isLoading,
    error,
  };
}
