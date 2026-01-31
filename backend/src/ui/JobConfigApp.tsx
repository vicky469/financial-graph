import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobsData } from './hooks/useJobsData';
import { useJobActions } from './hooks/useJobActions';
import { useJobForm } from './hooks/useJobForm';
import { getJobStatus, getLastSuccessTime } from './utils/jobHelpers';
import { MessageBanner } from './components/shared/MessageBanner';
import { EmptyState } from './components/shared/EmptyState';
import { JobStatusBadge } from './components/JobList/JobStatusBadge';
import { BasicInfoTab } from './components/JobForm/BasicInfoTab';
import { SourceTab } from './components/JobForm/SourceTab';
import { DestinationTab } from './components/JobForm/DestinationTab';

/**
 * Main Job Configuration UI Component
 * 
 * Fully refactored version with extracted components and hooks.
 * This component focuses on composition and orchestration.
 */
export default function JobConfigurationUI() {
  const navigate = useNavigate();
  const { jobs, isLoading, error } = useJobsData();
  const {
    message,
    messageType,
    showMessage,
    handleToggleJob,
    handleDeleteJob,
    handleExecuteJob,
    handleStopJob,
  } = useJobActions();

  const {
    formData,
    setFormData,
    showCreateModal,
    setShowCreateModal,
    activeTab,
    setActiveTab,
    showSourceDescription,
    setShowSourceDescription,
    sourceTypes,
    setSourceTypes,
    sourceLocationTypes,
    setSourceLocationTypes,
    destinationTypes,
    setDestinationTypes,
    validationErrors,
    isEditMode,
    clearForm,
    openEditModal,
    closeModal,
    updateFormField,
    updateSource,
    addSourceFilter,
    updateSourceFilter,
    removeSourceFilter,
    addDestination,
    updateDestination,
    removeDestination,
    handleSubmit,
    computeSourceName,
  } = useJobForm(showMessage);

  if (error) {
    return (
      <div className="app-container">
        <div className="message-banner message-error">
          <strong>Error:</strong> Failed to connect to database: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header">
        <div>
          <h1 className="app-title">Pipeline Job Configuration</h1>
          <p className="app-subtitle">
            Configure and monitor data pipeline jobs with Trigger.dev orchestration
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Job
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '400px',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            background:
              messageType === 'error'
                ? '#fee2e2'
                : messageType === 'success'
                ? '#d1fae5'
                : '#dbeafe',
            color:
              messageType === 'error'
                ? '#991b1b'
                : messageType === 'success'
                ? '#065f46'
                : '#1e40af',
            border: `1px solid ${
              messageType === 'error'
                ? '#fecaca'
                : messageType === 'success'
                ? '#a7f3d0'
                : '#bfdbfe'
            }`,
          }}
        >
          {message}
        </div>
      )}

      {/* Jobs List */}
      <div
        className="card"
        style={{ background: 'transparent', border: 'none', padding: 0 }}
      >
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h2 className="card-title">Jobs ({jobs.length})</h2>
        </div>

        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p className="text-muted">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState onCreateJob={() => setShowCreateModal(true)} />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Last Success</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job: any) => {
                  const status = getJobStatus(job);
                  const lastSuccessTime = getLastSuccessTime(job);
                  const latestExecution = job.executions?.[0];

                  return (
                    <tr
                      key={job.id}
                      onClick={() => openEditModal(job)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{job.name}</div>
                            {job.description && (
                              <div
                                className="text-small text-muted"
                                style={{ marginTop: '2px' }}
                              >
                                {job.description}
                              </div>
                            )}
                          </div>
                          <button
                            className="btn-delete-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteJob(job.id, job.name);
                            }}
                            title="Delete job"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      <td className="url-cell">
                        {job.sources?.[0]?.parameters?.url ? (
                          <a
                            href={job.sources[0].parameters.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-small text-mono"
                          >
                            {job.sources[0].parameters.url}
                          </a>
                        ) : job.sources?.[0]?.parameters?.location ? (
                          <div className="text-small text-mono">
                            {job.sources[0].parameters.location}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {job.destinations?.[0] ? (
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '4px',
                              }}
                            >
                              {job.destinations[0].parameters?.location_type && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    height: '18px',
                                    padding: '0 6px',
                                    borderRadius: '3px',
                                    background: 'rgba(234, 88, 12, 0.35)',
                                    color: '#fb923c',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    lineHeight: '18px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {job.destinations[0].parameters.location_type.replace(/_/g, ' ')}
                                </span>
                              )}
                              {job.destinations[0].parameters?.location && (
                                <span
                                  className="text-small text-mono text-muted"
                                  style={{
                                    maxWidth: '150px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {job.destinations[0].parameters.location}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ textTransform: 'capitalize' }}>
                          {job.schedule_type}
                        </div>
                        {job.schedule_type === 'cron' && job.cron_expression && (
                          <div className="text-small text-muted text-mono">
                            {job.cron_expression}
                          </div>
                        )}
                      </td>
                      <td>
                        <JobStatusBadge status={status} />
                      </td>
                      <td className="text-small text-muted">{lastSuccessTime}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div
                          className="flex gap-2"
                          style={{ justifyContent: 'flex-end' }}
                        >
                          {latestExecution && (
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() =>
                                navigate(`/executions/${latestExecution.id}`)
                              }
                              title="View execution logs"
                            >
                              Logs
                            </button>
                          )}
                          {status.text === 'Running' ? (
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() =>
                                handleStopJob(
                                  job.id,
                                  job.name,
                                  job.executions[0].id
                                )
                              }
                              title="Stop running job"
                            >
                              Stop
                            </button>
                          ) : (
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => handleExecuteJob(job.id, job.name)}
                              disabled={!job.enabled}
                              title={
                                job.enabled
                                  ? 'Execute job manually'
                                  : 'Job is disabled'
                              }
                            >
                              Execute
                            </button>
                          )}
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => handleToggleJob(job.id, !job.enabled)}
                            title={job.enabled ? 'Disable job' : 'Enable job'}
                          >
                            {job.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Job Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                {isEditMode ? 'Edit Job' : 'Create New Job'}
              </h2>
              <button
                className="btn btn-icon btn-secondary"
                onClick={closeModal}
                style={{ marginLeft: 'auto' }}
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
                type="button"
              >
                Basic Information
              </button>
              <button
                className={`tab ${activeTab === 'sources' ? 'active' : ''}`}
                onClick={() => setActiveTab('sources')}
                type="button"
              >
                Source
              </button>
              <button
                className={`tab ${activeTab === 'destinations' ? 'active' : ''}`}
                onClick={() => setActiveTab('destinations')}
                type="button"
              >
                Destination
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}
            >
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'visible' }}>
                {activeTab === 'basic' && (
                  <BasicInfoTab
                    formData={formData}
                    sourceTypes={sourceTypes}
                    showSourceDescription={showSourceDescription}
                    setShowSourceDescription={setShowSourceDescription}
                    setSourceTypes={setSourceTypes}
                    setFormData={setFormData}
                    updateSource={updateSource}
                    updateFormField={updateFormField}
                    computeSourceName={computeSourceName}
                    validationErrors={validationErrors}
                  />
                )}

                {activeTab === 'sources' && (
                  <SourceTab
                    formData={formData}
                    sourceLocationTypes={sourceLocationTypes}
                    setSourceLocationTypes={setSourceLocationTypes}
                    updateSource={updateSource}
                    addSourceFilter={addSourceFilter}
                    updateSourceFilter={updateSourceFilter}
                    removeSourceFilter={removeSourceFilter}
                  />
                )}

                {activeTab === 'destinations' && (
                  <DestinationTab
                    formData={formData}
                    destinationTypes={destinationTypes}
                    setDestinationTypes={setDestinationTypes}
                    updateDestination={updateDestination}
                    removeDestination={removeDestination}
                    addDestination={addDestination}
                  />
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (
                      confirm('Are you sure you want to clear all form data?')
                    ) {
                      clearForm();
                      showMessage('Form cleared successfully', 'success');
                    }
                  }}
                  style={{ marginRight: 'auto' }}
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditMode ? 'Update Job' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
