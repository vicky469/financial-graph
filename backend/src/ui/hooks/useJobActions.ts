import { useState } from 'react';
import * as jobService from '../services/jobService';

export type MessageType = 'info' | 'success' | 'error';

/**
 * Hook to manage job actions (CRUD operations)
 */
export function useJobActions() {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');

  const showMessage = (msg: string, type: MessageType = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('info');
    }, 5000);
  };

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    try {
      showMessage(`${enabled ? 'Enabling' : 'Disabling'} job...`, 'info');
      await jobService.toggleJob(jobId, enabled);
      showMessage(
        `Job ${enabled ? 'enabled' : 'disabled'} successfully`,
        'success'
      );
    } catch (error: any) {
      console.error('Failed to toggle job:', error);
      showMessage(
        `Failed to ${enabled ? 'enable' : 'disable'} job: ${error.message}`,
        'error'
      );
    }
  };

  const handleDeleteJob = async (jobId: string, jobName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete job "${jobName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      showMessage('Deleting job...', 'info');
      await jobService.deleteJob(jobId);
      showMessage('Job deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete job:', error);
      showMessage(`Failed to delete job: ${error.message}`, 'error');
    }
  };

  const handleExecuteJob = async (jobId: string, jobName: string) => {
    try {
      showMessage(`Starting execution of job "${jobName}"...`, 'info');
      const result = await jobService.executeJob(jobId);
      showMessage(
        `Job execution started successfully (ID: ${result.data?.execution.id})`,
        'success'
      );
    } catch (error: any) {
      console.error('Failed to execute job:', error);
      showMessage(`Failed to execute job: ${error.message}`, 'error');
    }
  };

  const handleStopJob = async (
    jobId: string,
    jobName: string,
    executionId: string
  ) => {
    try {
      showMessage(`Stopping job "${jobName}"...`, 'info');
      await jobService.stopJob(jobId, executionId);
      showMessage('Job stopped successfully', 'success');
    } catch (error: any) {
      console.error('Failed to stop job:', error);
      showMessage(`Failed to stop job: ${error.message}`, 'error');
    }
  };

  return {
    message,
    messageType,
    showMessage,
    handleToggleJob,
    handleDeleteJob,
    handleExecuteJob,
    handleStopJob,
  };
}
