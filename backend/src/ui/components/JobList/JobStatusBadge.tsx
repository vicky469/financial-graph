import React from 'react';
import { JobStatus } from '../../types/job.types';

interface JobStatusBadgeProps {
  status: JobStatus;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  return (
    <span className={`status-badge ${status.class}`}>
      <span>{status.icon}</span>
      <span>{status.text}</span>
    </span>
  );
}
