import React from 'react';
import { JobFilter } from '../../types/job.types';

interface FilterListProps {
  filters: JobFilter[];
  onAddFilter: () => void;
  onUpdateFilter: (
    index: number,
    field: 'field' | 'operator' | 'value',
    value: string | number | boolean
  ) => void;
  onRemoveFilter: (index: number) => void;
}

export function FilterList({
  filters,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
}: FilterListProps) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <label style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>
          Filters
        </label>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={onAddFilter}
        >
          + Add Filter
        </button>
      </div>

      {filters.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filters.map((filter, index) => (
            <div
              key={index}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              <select
                value={filter.field}
                onChange={(e) => onUpdateFilter(index, 'field', e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  background: '#1a1a1a',
                  color: '#e5e7eb',
                  fontSize: '13px',
                }}
              >
                <option value="limit">Limit</option>
                <option value="sp500">S&P 500</option>
                <option value="type">Type</option>
                <option value="name">Name</option>
                <option value="cik">CIK</option>
                <option value="ticker">Ticker</option>
                <option value="filing_date">Filing Date</option>
                <option value="form_type">Form Type</option>
              </select>

              <select
                value={filter.operator}
                onChange={(e) => onUpdateFilter(index, 'operator', e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  background: '#1a1a1a',
                  color: '#e5e7eb',
                  fontSize: '13px',
                }}
              >
                <option value="equals">=</option>
                <option value="contains">contains</option>
                <option value="starts_with">starts with</option>
                <option value="greater_than">&gt;</option>
                <option value="less_than">&lt;</option>
                <option value="in">in</option>
                <option value="not_in">not in</option>
              </select>

              {filter.field === 'sp500' ? (
                <select
                  value={filter.value.toString()}
                  onChange={(e) =>
                    onUpdateFilter(index, 'value', e.target.value === 'true')
                  }
                  style={{
                    flex: 1.5,
                    padding: '6px 8px',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    background: '#1a1a1a',
                    color: '#e5e7eb',
                    fontSize: '13px',
                  }}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type={filter.field === 'limit' ? 'number' : 'text'}
                  value={filter.value.toString()}
                  onChange={(e) =>
                    onUpdateFilter(
                      index,
                      'value',
                      filter.field === 'limit'
                        ? parseInt(e.target.value) || 0
                        : e.target.value
                    )
                  }
                  placeholder="Value"
                  style={{
                    flex: 1.5,
                    padding: '6px 8px',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    background: '#1a1a1a',
                    color: '#e5e7eb',
                    fontSize: '13px',
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => onRemoveFilter(index)}
                style={{
                  padding: '6px 10px',
                  background: 'transparent',
                  color: '#ef4444',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                }}
                title="Remove filter"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            color: '#6b7280',
            fontSize: '13px',
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          No filters configured. Click "Add Filter" to add filtering criteria.
        </p>
      )}
    </div>
  );
}
