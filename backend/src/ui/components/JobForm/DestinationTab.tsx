import React from 'react';
import { NotionCombobox } from '../../NotionCombobox';
import { JobFormData, TypeOption } from '../../types/job.types';

interface DestinationTabProps {
  formData: JobFormData;
  destinationTypes: TypeOption[];
  setDestinationTypes: (types: TypeOption[]) => void;
  updateDestination: (index: number, field: string, value: string) => void;
  removeDestination: (index: number) => void;
  addDestination: () => void;
}

export function DestinationTab({
  formData,
  destinationTypes,
  setDestinationTypes,
  updateDestination,
  removeDestination,
  addDestination,
}: DestinationTabProps) {
  return (
    <div className="tab-content">
      <div className="form-section">
        {formData.destinations.map((destination, index) => (
          <div
            key={index}
            style={{
              marginBottom:
                index < formData.destinations.length - 1 ? '24px' : '0',
            }}
          >
            {index > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  padding: '16px',
                  border: '1px solid #333',
                  borderRadius: '4px 4px 0 0',
                  background: '#1a1a1a',
                }}
              >
                <h4 style={{ margin: 0, color: '#e5e7eb' }}>
                  Destination {index + 1}
                </h4>
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => removeDestination(index)}
                >
                  Remove
                </button>
              </div>
            )}

            {index === 0 && formData.destinations.length > 1 && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: '#222',
                  borderRadius: '4px',
                }}
              >
                <h4 style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>
                  Primary Destination
                </h4>
              </div>
            )}

            <div
              style={{
                padding: index > 0 ? '16px' : '0',
                border: index > 0 ? '1px solid #333' : 'none',
                borderTop: index > 0 ? 'none' : 'none',
                borderRadius: index > 0 ? '0 0 4px 4px' : '0',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: 0,
                }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label
                    className="form-label"
                    style={{
                      fontSize: '13px',
                      marginBottom: '6px',
                      color: '#9ca3af',
                    }}
                  >
                    Destination Type
                  </label>
                  <NotionCombobox
                    options={destinationTypes}
                    value={destination.location_type}
                    onChange={(value) => {
                      if (value) {
                        updateDestination(index, 'location_type', value);
                      } else {
                        updateDestination(index, 'location_type', '');
                      }
                    }}
                    onCreateOption={(newOption) => {
                      setDestinationTypes([...destinationTypes, newOption]);
                    }}
                    onDeleteOption={(value) => {
                      setDestinationTypes(
                        destinationTypes.filter((t) => t.value !== value)
                      );
                      formData.destinations.forEach((dest, i) => {
                        if (dest.location_type === value) {
                          updateDestination(i, 'location_type', '');
                        }
                      });
                    }}
                    onUpdateOption={(value, updates) => {
                      setDestinationTypes(
                        destinationTypes.map((t) =>
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
                    style={{
                      fontSize: '13px',
                      marginBottom: '6px',
                      color: '#9ca3af',
                    }}
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={destination.location}
                    onChange={(e) =>
                      updateDestination(index, 'location', e.target.value)
                    }
                    placeholder={
                      destination.location_type === 'r2_bucket'
                        ? 'R2: sec-2025/custom/path'
                        : '/path/to/output or table_name'
                    }
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                  {destination.location_type === 'r2_bucket' && (
                    <small
                      className="form-hint"
                      style={{ fontSize: '12px', marginTop: '4px' }}
                    >
                      Examples: R2: sec-2025, R2: sec-2026
                    </small>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Destination Button */}
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addDestination}
            style={{ width: '100%' }}
          >
            + Add Another Destination
          </button>
        </div>
      </div>
    </div>
  );
}
