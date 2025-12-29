// Edge editing panel component

import { useState, useRef, useEffect, useCallback } from "react";
import { updateEdge, deleteEdge } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Edge } from "../../types";

interface EdgePanelProps {
  edge: Edge;
  isEntityEdge?: boolean;
  onCancel: () => void;
}

const PRESET_LABELS = [
  { label: "led to", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  { label: "triggered", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  { label: "caused", color: "#f97316", bg: "rgba(249, 115, 22, 0.15)" },
  { label: "concurrent with", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" },
];

const PRESET_LABEL_NAMES = PRESET_LABELS.map((p) => p.label);

export function EdgePanel({ edge, isEntityEdge = false, onCancel }: EdgePanelProps) {
  const [localEdge, setLocalEdge] = useState(edge);
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const previousEdgeRef = useRef(edge);
  const pendingChangesRef = useRef<Partial<Edge>>({});
  const panelRef = useRef<HTMLElement>(null);

  const savePendingChanges = useCallback(() => {
    const changes = pendingChangesRef.current;
    if (Object.keys(changes).length > 0) {
      updateEdge(edge.id, previousEdgeRef.current, changes);
      previousEdgeRef.current = { ...previousEdgeRef.current, ...changes };
      pendingChangesRef.current = {};
    }
  }, [edge.id]);

  const handleSaveAndClose = useCallback(() => {
    savePendingChanges();
    onCancel();
  }, [savePendingChanges, onCancel]);

  const handleCancel = () => {
    pendingChangesRef.current = {};
    onCancel();
  };

  // Save on click outside
  useClickOutside(panelRef, handleSaveAndClose, true);

  // Save on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSaveAndClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleSaveAndClose]);

  // Update local state when edge prop changes
  useEffect(() => {
    setLocalEdge(edge);
    previousEdgeRef.current = edge;
    pendingChangesRef.current = {};
  }, [edge.id]);

  const handleChange = (updates: Partial<Edge>) => {
    setLocalEdge((prev) => ({ ...prev, ...updates }));
    pendingChangesRef.current = { ...pendingChangesRef.current, ...updates };
  };

  // Simplified panel for entity-event connections
  if (isEntityEdge) {
    return (
      <section ref={panelRef} className="sidebar-section event-details">
        <div className="section-header">
          <h2>Entity Connection</h2>
          <button
            className="btn-icon danger"
            onClick={() => deleteEdge(edge.id, edge)}
            title="Delete Connection"
          >
            🗑️
          </button>
        </div>
        <div className="event-card">
          <div className="button-group" style={{ marginTop: "16px" }}>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-compact">
              Cancel
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Full panel for event-event connections
  const allLabels = [
    ...PRESET_LABELS,
    ...customLabels
      .filter((l) => !PRESET_LABEL_NAMES.includes(l))
      .map((l) => ({
        label: l,
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.15)",
      })),
  ];

  return (
    <section ref={panelRef} className="sidebar-section event-details">
      <div className="section-header">
        <h2>Edit Connection</h2>
        <button
          className="btn-icon danger"
          onClick={() => deleteEdge(edge.id, edge)}
          title="Delete Connection"
        >
          🗑️
        </button>
      </div>
      <div className="event-card">
        <label className="field-label">Type</label>
        <div className="button-group">
          <button
            className={`btn ${localEdge.edgeType !== "simultaneous" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleChange({ edgeType: "causal" })}
          >
            Causal
          </button>
          <button
            className={`btn ${localEdge.edgeType === "simultaneous" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleChange({ edgeType: "simultaneous" })}
          >
            Simultaneous
          </button>
        </div>

        <label className="field-label">Label</label>
        <div
          className="label-suggestions"
          style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}
        >
          {allLabels.map(({ label, color, bg }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: bg,
                border: `1px solid ${color}40`,
                borderRadius: "12px",
                padding: "2px 8px 2px 10px",
                cursor: "pointer",
                fontSize: "0.75rem",
                transition: "all 0.2s",
              }}
              onClick={() => handleChange({ label })}
            >
              <span style={{ color, marginRight: "4px", fontWeight: 500 }}>{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomLabels((prev) => prev.filter((l) => l !== label));
                }}
                className="btn-icon small"
                style={{
                  padding: "2px",
                  fontSize: "0.65rem",
                  color,
                  opacity: 0.7,
                  background: "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "2px",
                }}
                title="Remove label"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <input
          type="text"
          className="input"
          value={localEdge.label}
          placeholder="Type label and press Enter to save..."
          onChange={(e) => handleChange({ label: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && localEdge.label.trim()) {
              const val = localEdge.label.trim();
              if (!customLabels.includes(val) && !PRESET_LABEL_NAMES.includes(val)) {
                setCustomLabels([...customLabels, val]);
              }
            }
          }}
        />

        <div className="button-group" style={{ marginTop: "16px" }}>
          <button type="button" onClick={handleCancel} className="btn btn-secondary btn-compact">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

export default EdgePanel;
