import React from 'react';

interface EmptyStateProps {
  onCreateJob: () => void;
}

export function EmptyState({ onCreateJob }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📋</div>
      <div className="empty-state-title">No jobs configured yet</div>
      <div className="empty-state-description">
        Create your first job to get started with pipeline automation
      </div>
      <button className="btn btn-primary" onClick={onCreateJob}>
        Create Your First Job
      </button>
    </div>
  );
}
