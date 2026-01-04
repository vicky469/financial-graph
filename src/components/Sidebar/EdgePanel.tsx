// Edge editing panel component

import { useState, useRef, useEffect, useCallback } from "react";
import { updateEdge, deleteEdge } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Edge } from "../../types";
import { Input } from "../ui/input";

interface EdgePanelProps {
  edge: Edge;
  onCancel: () => void;
}

export function EdgePanel({ edge, onCancel }: EdgePanelProps) {
  const [localEdge, setLocalEdge] = useState(edge);
  const previousEdgeRef = useRef(edge);
  const pendingChangesRef = useRef<Partial<Edge>>({});
  const panelRef = useRef<HTMLElement>(null);

  const savePendingChanges = useCallback(async () => {
    const changes = pendingChangesRef.current;
    if (Object.keys(changes).length > 0) {
      await updateEdge(edge.id, previousEdgeRef.current, changes);
      previousEdgeRef.current = { ...previousEdgeRef.current, ...changes };
      pendingChangesRef.current = {};
    }
  }, [edge.id]);

  const handleSaveAndClose = useCallback(async () => {
    await savePendingChanges();
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
        <label className="field-label">Ownership Percentage</label>
        <Input
          type="number"
          min={0}
          max={100}
          value={localEdge.ownership ?? ""}
          onChange={(e) =>
            handleChange({
              ownership: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="0-100"
        />

        <div className="button-group" style={{ marginTop: "16px", gap: "8px" }}>
          <button type="button" onClick={handleSaveAndClose} className="btn btn-primary btn-compact">
            Save
          </button>
          <button type="button" onClick={handleCancel} className="btn btn-secondary btn-compact">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

export default EdgePanel;
