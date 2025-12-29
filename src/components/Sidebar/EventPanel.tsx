// Event editing panel component

import { useState, useEffect, useRef, useCallback } from "react";
import { updateEvent } from "../../db";
import { db, tx } from "../../db";
import type { Event, Edge } from "../../types";

interface EventPanelProps {
  event: Event;
  edges: Edge[];
}

export function EventPanel({ event, edges }: EventPanelProps) {
  const [localEvent, setLocalEvent] = useState(event);
  const previousEventRef = useRef(event);
  const pendingChangesRef = useRef<Partial<Event>>({});

  const savePendingChanges = useCallback(() => {
    const changes = pendingChangesRef.current;
    if (Object.keys(changes).length > 0) {
      updateEvent(event.id, previousEventRef.current, changes);
      previousEventRef.current = { ...previousEventRef.current, ...changes };
      pendingChangesRef.current = {};
    }
  }, [event.id]);

  // Save pending changes when switching events or unmounting
  useEffect(() => {
    return () => {
      savePendingChanges();
    };
  }, [savePendingChanges]);

  // Update local state when event prop changes
  useEffect(() => {
    // Save any pending changes from previous event
    savePendingChanges();

    // Reset state for new event
    setLocalEvent(event);
    previousEventRef.current = event;
    pendingChangesRef.current = {};
  }, [event.id, savePendingChanges]);

  const handleChange = (updates: Partial<Event>) => {
    // Update local state immediately for instant UI feedback
    setLocalEvent((prev) => ({ ...prev, ...updates }));
    // Track pending changes
    pendingChangesRef.current = { ...pendingChangesRef.current, ...updates };
  };

  const handleBlur = () => {
    // Save when field loses focus
    savePendingChanges();
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

  return (
    <section className="sidebar-section event-details">
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
          onBlur={handleBlur}
        />

        <label className="field-label">Date</label>
        <input
          type="date"
          className="input"
          value={localEvent.date}
          onChange={(e) => handleChange({ date: e.target.value })}
          onBlur={handleBlur}
        />

        <label className="field-label">Description</label>
        <textarea
          className="input textarea"
          rows={3}
          value={localEvent.description}
          placeholder="Add details..."
          onChange={(e) => handleChange({ description: e.target.value })}
          onBlur={handleBlur}
        />

        <label className="checkbox-label" style={{ marginTop: "8px" }}>
          <input
            type="checkbox"
            checked={localEvent.isTrigger}
            onChange={(e) => {
              handleChange({ isTrigger: e.target.checked });
              // Checkboxes don't have blur, so save immediately
              setTimeout(savePendingChanges, 0);
            }}
          />
          Is a trigger
        </label>
      </div>
    </section>
  );
}

export default EventPanel;
