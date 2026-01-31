import React from 'react';
import { NotionCombobox } from '../../NotionCombobox';
import { JobFormData, TypeOption } from '../../types/job.types';
import { FilterList } from './FilterList';

interface SourceTabProps {
  formData: JobFormData;
  sourceLocationTypes: TypeOption[];
  setSourceLocationTypes: (types: TypeOption[]) => void;
  updateSource: (field: string, value: string) => void;
  addSourceFilter: () => void;
  updateSourceFilter: (
    index: number,
    field: 'field' | 'operator' | 'value',
    value: string | number | boolean
  ) => void;
  removeSourceFilter: (index: number) => void;
}

export function SourceTab({
  formData,
  sourceLocationTypes,
  setSourceLocationTypes,
  updateSource,
  addSourceFilter,
  updateSourceFilter,
  removeSourceFilter,
}: SourceTabProps) {
  return (
    <div className="tab-content" style={{ padding: '24px' }}>
      <div className="form-section" style={{ marginBottom: '20px' }}>
        {!formData.source ? (
          <p className="info-text" style={{ color: '#9ca3af', fontSize: '14px' }}>
            No source configured. Configure source type in Basic Information tab.
          </p>
        ) : (
          <>
            {/* URL */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label
                className="form-label"
                style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
              >
                URL
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.source?.url || ''}
                onChange={(e) => updateSource('url', e.target.value)}
                placeholder="https://example.com/data"
                style={{ padding: '8px 12px', fontSize: '13px' }}
              />
            </div>

            {/* Location Type + Location */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  className="form-label"
                  style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
                >
                  Location Type
                </label>
                <NotionCombobox
                  options={sourceLocationTypes}
                  value={formData.source?.location_type || ''}
                  onChange={(value) => updateSource('location_type', value || '')}
                  onCreateOption={(newOption) => {
                    setSourceLocationTypes([...sourceLocationTypes, newOption]);
                  }}
                  onDeleteOption={(value) => {
                    setSourceLocationTypes(
                      sourceLocationTypes.filter((t) => t.value !== value)
                    );
                    if (formData.source?.location_type === value) {
                      updateSource('location_type', '');
                    }
                  }}
                  onUpdateOption={(value, updates) => {
                    setSourceLocationTypes(
                      sourceLocationTypes.map((t) =>
                        t.value === value ? { ...t, ...updates } : t
                      )
                    );
                  }}
                  creatable={true}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  className="form-label"
                  style={{ fontSize: '13px', marginBottom: '6px', color: '#9ca3af' }}
                >
                  Location
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.source?.location || ''}
                  onChange={(e) => updateSource('location', e.target.value)}
                  placeholder="/path/to/data"
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                />
              </div>
            </div>
          </>
        )}

        {/* Filters Section */}
        <FilterList
          filters={formData.source?.filters || []}
          onAddFilter={addSourceFilter}
          onUpdateFilter={updateSourceFilter}
          onRemoveFilter={removeSourceFilter}
        />
      </div>
    </div>
  );
}
