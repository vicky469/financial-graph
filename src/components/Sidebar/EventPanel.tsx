// Event editing panel component

import { useState, useEffect, useRef, useCallback } from "react";
import { updateEvent } from "../../db";
import { db, tx } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Event, Edge } from "../../types";

interface EventPanelProps {
  event: Event;
  edges: Edge[];
  onCancel: () => void;
}

export function EventPanel({ event, edges, onCancel }: EventPanelProps) {
  const [localEvent, setLocalEvent] = useState(event);
  const previousEventRef = useRef(event);
  const pendingChangesRef = useRef<Partial<Event>>({});
  const panelRef = useRef<HTMLElement>(null);

  const savePendingChanges = useCallback(() => {
    const changes = pendingChangesRef.current;
    if (Object.keys(changes).length > 0) {
      updateEvent(event.id, previousEventRef.current, changes);
      previousEventRef.current = { ...previousEventRef.current, ...changes };
      pendingChangesRef.current = {};
    }
  }, [event.id]);

  const handleSaveAndClose = useCallback(() => {
    savePendingChanges();
    onCancel();
  }, [savePendingChanges, onCancel]);

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

  // Update local state when event prop changes
  useEffect(() => {
    setLocalEvent(event);
    previousEventRef.current = event;
    pendingChangesRef.current = {};
  }, [event.id]);

  const handleChange = (updates: Partial<Event>) => {
    // Update local state immediately for instant UI feedback
    setLocalEvent((prev) => ({ ...prev, ...updates }));
    // Track pending changes
    pendingChangesRef.current = { ...pendingChangesRef.current, ...updates };
  };

  const handleDelete = () => {
    const deleteTx = [
      ...edges
        .filter((e) => e.sourceId === event.id || e.targetId === event.id)
        .map((e) => tx.edges[e.id].delete()),
      tx.events[event.id].delete(),
    ];
    db.transact(deleteTx);
  };

  const handleCancel = () => {
    // Discard any pending changes
    pendingChangesRef.current = {};
    onCancel();
  };

  return (
    <section ref={panelRef} className="sidebar-section event-details">
      <div className="section-header">
        <h2>Edit Event</h2>
        <button className="btn-icon danger" onClick={handleDelete} title="Delete Event">
          🗑️
        </button>
      </div>
      <div className="event-card">
        <label className="field-label">Title</label>
        <input
          type="text"
          className="input"
          value={localEvent.title}
          onChange={(e) => handleChange({ title: e.target.value })}
        />

        <label className="field-label">Date</label>
        <input
          type="date"
          className="input"
          value={localEvent.date}
          onChange={(e) => handleChange({ date: e.target.value })}
        />

        <label className="field-label">Link</label>
        <input
          type="url"
          className="input"
          value={localEvent.link || ""}
          placeholder="https://..."
          onChange={(e) => handleChange({ link: e.target.value })}
        />

        <label className="field-label">Description</label>
        <textarea
          className="input textarea"
          rows={3}
          value={localEvent.description}
          placeholder="Add details..."
          onChange={(e) => handleChange({ description: e.target.value })}
        />

        <label className="checkbox-label" style={{ marginTop: "8px" }}>
          <input
            type="checkbox"
            checked={localEvent.isTrigger}
            onChange={(e) => handleChange({ isTrigger: e.target.checked })}
          />
          Is a trigger
        </label>

        <div className="button-group" style={{ marginTop: "16px" }}>
          <button type="button" onClick={handleCancel} className="btn btn-secondary btn-compact">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

export default EventPanel;
