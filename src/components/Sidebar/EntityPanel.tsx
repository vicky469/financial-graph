// Entity editing panel component

import { useState } from "react";
import { updateEntity, deleteEntity, createEdge, deleteEdge } from "../../db";
import type { Entity, Event, Edge } from "../../types";

interface EntityPanelProps {
  entity: Entity;
  events: Event[];
  edges: Edge[];
}

export function EntityPanel({ entity, events, edges }: EntityPanelProps) {
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");

  const connectedEdges = edges.filter((e) => e.sourceId === entity.id);
  const unconnectedEvents = events.filter(
    (evt) => !edges.some((e) => e.sourceId === entity.id && e.targetId === evt.id)
  );

  const handleAddProperty = () => {
    if (!newPropKey.trim() || !newPropValue.trim()) return;
    updateEntity(entity.id, entity, {
      properties: {
        ...entity.properties,
        [newPropKey.trim()]: newPropValue.trim(),
      },
    });
    setNewPropKey("");
    setNewPropValue("");
  };

  const handleDeleteProperty = (key: string) => {
    const newProps = { ...entity.properties };
    delete newProps[key];
    updateEntity(entity.id, entity, { properties: newProps });
  };

  const handleLinkSelected = () => {
    const checkboxes = document.querySelectorAll(
      ".link-event-checkbox:checked"
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
      createEdge(entity.id, cb.value, "", "causal");
      cb.checked = false;
    });
  };

  return (
    <section className="sidebar-section event-details">
      <div className="section-header">
        <h2>Edit Entity</h2>
        <button
          className="btn-icon danger"
          onClick={() => deleteEntity(entity.id, entity)}
          title="Delete Entity"
        >
          🗑️
        </button>
      </div>
      <div className="event-card">
        <label className="field-label">Name</label>
        <input
          type="text"
          className="input"
          value={entity.name}
          onChange={(e) => updateEntity(entity.id, entity, { name: e.target.value })}
        />

        <label className="field-label">Type</label>
        <input
          type="text"
          className="input"
          value={entity.type}
          onChange={(e) => updateEntity(entity.id, entity, { type: e.target.value })}
        />

        {/* Properties Section */}
        <div className="properties-section">
          <label className="field-label">Properties</label>
          <div className="props-list">
            {Object.entries(entity.properties || {}).map(([k, v]) => (
              <div
                key={k}
                className="prop-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span className="prop-key" style={{ color: "#a78bfa", fontWeight: 500 }}>
                  {k}:
                </span>
                <span className="prop-value" style={{ color: "#e2e8f0", flex: 1 }}>
                  {v}
                </span>
                <button
                  className="btn-icon small"
                  style={{
                    color: "#ef4444",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                  onClick={() => handleDeleteProperty(k)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="add-prop-row">
            <input
              placeholder="Key (e.g. Assets)"
              value={newPropKey}
              onChange={(e) => setNewPropKey(e.target.value)}
              className="input small"
            />
            <input
              placeholder="Value (e.g. $200B)"
              value={newPropValue}
              onChange={(e) => setNewPropValue(e.target.value)}
              className="input small"
            />
            <button className="btn btn-secondary small" onClick={handleAddProperty}>
              Add
            </button>
          </div>
        </div>

        {/* Link to Events Section */}
        <div
          className="link-section"
          style={{
            marginTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "16px",
          }}
        >
          <label className="field-label">Link to Events</label>
          <div style={{ maxHeight: "150px", overflowY: "auto", marginBottom: "8px" }}>
            {unconnectedEvents.map((evt) => (
              <label
                key={evt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 0",
                  fontSize: "0.85rem",
                  color: "#e2e8f0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  className="link-event-checkbox"
                  value={evt.id}
                  style={{ accentColor: "#a78bfa" }}
                />
                {evt.title}
              </label>
            ))}
          </div>
          <button className="btn btn-secondary small" onClick={handleLinkSelected}>
            🔗 Link Selected
          </button>

          {/* Show existing connections */}
          {connectedEdges.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Connected to:</span>
              <ul style={{ margin: "4px 0", padding: "0 0 0 16px" }}>
                {connectedEdges.map((edge) => {
                  const targetEvent = events.find((ev) => ev.id === edge.targetId);
                  return targetEvent ? (
                    <li
                      key={edge.id}
                      style={{
                        fontSize: "0.8rem",
                        color: "#e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {targetEvent.title}
                      <button
                        className="btn-icon small"
                        style={{
                          color: "#ef4444",
                          background: "transparent",
                          border: "none",
                          padding: "2px",
                          fontSize: "0.65rem",
                        }}
                        onClick={() => deleteEdge(edge.id, edge)}
                        title="Remove connection"
                      >
                        ✕
                      </button>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default EntityPanel;
