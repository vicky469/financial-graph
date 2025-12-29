// Event editing panel component

import { updateEvent } from "../../db";
import { db, tx } from "../../db";
import type { Event, Edge } from "../../types";

interface EventPanelProps {
  event: Event;
  edges: Edge[];
}

export function EventPanel({ event, edges }: EventPanelProps) {
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
          value={event.title}
          onChange={(e) => updateEvent(event.id, event, { title: e.target.value })}
        />

        <label className="field-label">Date</label>
        <input
          type="date"
          className="input"
          value={event.date}
          onChange={(e) => updateEvent(event.id, event, { date: e.target.value })}
        />

        <label className="field-label">Description</label>
        <textarea
          className="input textarea"
          rows={3}
          value={event.description}
          placeholder="Add details..."
          onChange={(e) => updateEvent(event.id, event, { description: e.target.value })}
        />

        <label className="checkbox-label" style={{ marginTop: "8px" }}>
          <input
            type="checkbox"
            checked={event.isTrigger}
            onChange={(e) => updateEvent(event.id, event, { isTrigger: e.target.checked })}
          />
          Is a trigger
        </label>
      </div>
    </section>
  );
}

export default EventPanel;
