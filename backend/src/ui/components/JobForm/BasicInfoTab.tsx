import React from 'react';
import { NotionCombobox } from '../../NotionCombobox';
import { JobFormData, TypeOption } from '../../types/job.types';

interface BasicInfoTabProps {
  formData: JobFormData;
  sourceTypes: TypeOption[];
  showSourceDescription: boolean;
  setShowSourceDescription: (show: boolean) => void;
  setSourceTypes: (types: TypeOption[]) => void;
  setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
  updateSource: (field: string, value: string) => void;
  updateFormField: (field: keyof JobFormData, value: any) => void;
  computeSourceName: (type: string, year: string, quarter: string, month: string, day: string) => string;
  validationErrors: Record<string, string>;
}

export function BasicInfoTab({
  formData,
  sourceTypes,
  showSourceDescription,
  setShowSourceDescription,
  setSourceTypes,
  setFormData,
  updateSource,
  updateFormField,
  computeSourceName,
  validationErrors,
}: BasicInfoTabProps) {
  return (
    <div className="tab-content" style={{ padding: '24px' }}>
      {/* Job Info - Primary */}
      <div className="form-section" style={{ marginBottom: '24px' }}>
        {/* Row 1: Type + Year/Month */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label
              className="form-label"
              style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
            >
              Job Type *
            </label>
            <NotionCombobox
              options={sourceTypes}
              value={formData.job_type || null}
              onChange={(value) => {
                const newType = value || '';
                setFormData((prev) => {
                  // Auto-compute name if not manually overridden
                  if (!prev.nameOverride) {
                    const newName = computeSourceName(
                      newType,
                      prev.source?.year || '',
                      prev.source?.quarter || '',
                      prev.source?.month || '',
                      prev.source?.day || ''
                    );
                    return { ...prev, job_type: newType, name: newName };
                  }
                  return { ...prev, job_type: newType };
                });
                updateSource('type', newType);
              }}
              onCreateOption={(newOption) => {
                setSourceTypes([...sourceTypes, newOption]);
              }}
              onDeleteOption={(value) => {
                setSourceTypes(sourceTypes.filter((t) => t.value !== value));
                if (formData.job_type === value) {
                  setFormData((prev) => ({ ...prev, job_type: '' }));
                  updateSource('type', '');
                }
              }}
              onUpdateOption={(value, updates) => {
                setSourceTypes(
                  sourceTypes.map((t) =>
                    t.value === value ? { ...t, ...updates } : t
                  )
                );
              }}
              creatable={true}
            />
            {validationErrors.job_type && (
              <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                {validationErrors.job_type}
              </small>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label
              className="form-label"
              style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
            >
              Time Period
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 50px 50px 50px', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={formData.source?.year || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  updateSource('year', value);
                }}
                placeholder="YYYY"
                maxLength={4}
                style={{ padding: '8px 10px', fontSize: '13px' }}
                title="Year"
              />
              <input
                type="text"
                className="form-input"
                value={formData.source?.quarter || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 1);
                  const quarter = parseInt(value);
                  if (value && (quarter < 1 || quarter > 4)) {
                    return;
                  }
                  updateSource('quarter', value);
                }}
                placeholder="Q"
                maxLength={1}
                style={{ padding: '8px 10px', fontSize: '13px' }}
                title="Quarter (1-4)"
              />
              <input
                type="text"
                className="form-input"
                value={formData.source?.month || ''}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '').slice(0, 2);
                  if (value.length === 1 && parseInt(value) > 1) {
                    value = '0' + value;
                  }
                  if (value.length === 2) {
                    const month = parseInt(value);
                    if (month < 1 || month > 12) {
                      return;
                    }
                  }
                  updateSource('month', value);
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value.length === 1) {
                    updateSource('month', '0' + value);
                  }
                }}
                placeholder="MM"
                maxLength={2}
                style={{ padding: '8px 10px', fontSize: '13px' }}
                title="Month (01-12)"
              />
              <input
                type="text"
                className="form-input"
                value={formData.source?.day || ''}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '').slice(0, 2);
                  if (value.length === 1 && parseInt(value) > 3) {
                    value = '0' + value;
                  }
                  if (value.length === 2) {
                    const day = parseInt(value);
                    if (day < 1 || day > 31) {
                      return;
                    }
                  }
                  updateSource('day', value);
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value.length === 1) {
                    updateSource('day', '0' + value);
                  }
                }}
                placeholder="DD"
                maxLength={2}
                style={{ padding: '8px 10px', fontSize: '13px' }}
                title="Day (01-31)"
              />
            </div>
            <small
              className="form-hint"
              style={{ fontSize: '11px', marginTop: '4px', color: '#6b7280', display: 'block' }}
            >
              Optional: Specify year, quarter (1-4), month, or day for time-based filtering
            </small>
          </div>
        </div>

        {/* Row 2: Job Name (auto-computed) */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label
            className="form-label"
            style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
          >
            Job Name *
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              value={formData.name || ''}
              onChange={(e) => {
                updateFormField('name', e.target.value);
              }}
              placeholder="Auto-generated from type, year, quarter, month, day"
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
            />
            {formData.nameOverride && (
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, nameOverride: false }));
                  const newName = computeSourceName(
                    formData.job_type,
                    formData.source?.year || '',
                    formData.source?.quarter || '',
                    formData.source?.month || '',
                    formData.source?.day || ''
                  );
                  updateFormField('name', newName);
                }}
                title="Reset to auto-generated name"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Reset
              </button>
            )}
            <button
              type="button"
              className="btn btn-small btn-secondary"
              onClick={() => setShowSourceDescription(!showSourceDescription)}
              style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '13px' }}
            >
              {showSourceDescription ? '− description' : '+ description'}
            </button>
          </div>
          {!formData.nameOverride && formData.name && (
            <small
              className="form-hint"
              style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}
            >
              Auto-generated from type, year, quarter, month, and day
            </small>
          )}
          {validationErrors.name && (
            <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              {validationErrors.name}
            </small>
          )}

          {/* Description (collapsible) */}
          {showSourceDescription && (
            <div
              className="form-group"
              style={{ marginTop: '16px', marginBottom: 0 }}
            >
              <textarea
                className="form-textarea"
                value={formData.source?.description || ''}
                onChange={(e) => updateSource('description', e.target.value)}
                placeholder="Describe what this job does..."
                rows={2}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  minHeight: '60px',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Enable Job & Schedule */}
      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label
            style={{
              fontSize: '13px',
              color: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => updateFormField('enabled', e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Enable job immediately
          </label>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label
            htmlFor="schedule_type"
            className="form-label"
            style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
          >
            Schedule Type *
          </label>
          <select
            id="schedule_type"
            className="form-select"
            value={formData.schedule_type}
            onChange={(e) =>
              updateFormField('schedule_type', e.target.value as any)
            }
            required
            style={{ padding: '8px 12px', fontSize: '13px' }}
          >
            <option value="manual">Manual (on demand)</option>
            <option value="interval">Interval (every X minutes)</option>
            <option value="cron">Cron Expression</option>
          </select>
        </div>

        {/* Interval Minutes Input */}
        {formData.schedule_type === 'interval' && (
          <div className="form-group" style={{ marginTop: '16px', marginBottom: 0 }}>
            <label
              htmlFor="interval_minutes"
              className="form-label"
              style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
            >
              Interval (minutes) *
            </label>
            <input
              id="interval_minutes"
              type="number"
              className="form-input"
              value={formData.interval_minutes}
              onChange={(e) =>
                updateFormField('interval_minutes', parseInt(e.target.value) || 60)
              }
              min={1}
              max={10080}
              required
              style={{ padding: '8px 12px', fontSize: '13px' }}
            />
            <small
              className="form-hint"
              style={{ fontSize: '11px', marginTop: '4px', color: '#6b7280', display: 'block' }}
            >
              {formData.interval_minutes < 60
                ? `Every ${formData.interval_minutes} minute${formData.interval_minutes !== 1 ? 's' : ''}`
                : formData.interval_minutes < 1440
                ? `Every ${Math.floor(formData.interval_minutes / 60)} hour${Math.floor(formData.interval_minutes / 60) !== 1 ? 's' : ''}`
                : `Every ${Math.floor(formData.interval_minutes / 1440)} day${Math.floor(formData.interval_minutes / 1440) !== 1 ? 's' : ''}`}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
