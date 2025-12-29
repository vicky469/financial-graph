import { useState, useCallback } from "react";
import {
  useGraph,
  createEvent,
  updateEvent,
  updateEdge,
  deleteEdge,
  createEdge,
  createEntity,
  updateEntity,
  deleteEntity,
  db,
  tx,
} from "../db";
import type { Event, Edge, Entity, AppContext } from "../types";

interface Props {
  context: AppContext;
  onFocusTrigger: (triggerId: string) => void;
  onSelectEntity?: (entityId: string) => void;
  showActors: boolean;
  onToggleActors: () => void;
}

const Sidebar = ({
  context,
  onFocusTrigger,
  onSelectEntity,
  showActors,
  onToggleActors,
}: Props) => {
  const { events, entities, edges } = useGraph();
  const [activeTab, setActiveTab] = useState<"timeline" | "actors">("timeline");
  const [showForm, setShowForm] = useState(false);

  // Event Form State
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [isTrigger, setIsTrigger] = useState(false);

  // Entity Form State
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("");

  // Property Editor State
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");

  // Custom Edge Labels
  const [customLabels, setCustomLabels] = useState<string[]>([
    "led to",
    "triggered",
    "caused",
    "concurrent with",
  ]);

  const triggers = events.filter((e) => e.isTrigger);
  const selected = events.find((e) => e.id === context.selectedEventId);
  const selectedEntity = entities.find(
    (e) => e.id === context.selectedEntityId
  );
  const selectedEdge = edges.find((e) => e.id === context.selectedEdgeId);

  const handleAdd = useCallback(async () => {
    if (activeTab === "timeline") {
      if (!title.trim() || !date) return;
      await createEvent({
        title: title.trim(),
        description: "",
        date,
        isTrigger,
      });
      setTitle("");
      setDate("");
      setIsTrigger(false);
    } else {
      if (!entityName.trim() || !entityType.trim()) return;
      await createEntity({
        name: entityName.trim(),
        type: entityType.trim(),
        properties: {},
      });
      setEntityName("");
      setEntityType("");
    }
    setShowForm(false);
  }, [activeTab, title, date, isTrigger, entityName, entityType]);

  const handleClear = useCallback(async () => {
    // confirm() caused issues for user, removing it for now
    await db.transact([
      ...edges.map((e: Edge) => tx.edges[e.id].delete()),
      ...events.map((e: Event) => tx.events[e.id].delete()),
      ...entities.map((e: Entity) => tx.entities[e.id].delete()),
    ]);
  }, [events, edges, entities]);

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>💥 Failure Tracker</h1>
        <div className="sidebar-tabs">
          <button
            className={`tab ${activeTab === "timeline" ? "active" : ""}`}
            onClick={() => setActiveTab("timeline")}
          >
            Timeline
          </button>
          <button
            className={`tab ${activeTab === "actors" ? "active" : ""} ${
              showActors ? "toggled" : ""
            }`}
            onClick={() => {
              setActiveTab("actors");
              onToggleActors(); // Toggle entity visibility in graph
            }}
          >
            Actors {showActors ? "👁️" : ""}
          </button>
        </div>
      </header>

      <section className="sidebar-section scrollable">
        {activeTab === "timeline" ? (
          <>
            <div className="section-header">
              <h2>🔴 Triggers</h2>
              <span className="count-badge">{triggers.length}</span>
            </div>
            {triggers.length === 0 ? (
              <p className="empty-message">No triggers yet</p>
            ) : (
              <ul className="trigger-list">
                {triggers.map((t) => (
                  <li
                    key={t.id}
                    className={`trigger-item ${
                      context.focusedTriggerId === t.id ? "focused" : ""
                    }`}
                  >
                    <div
                      style={{ flex: 1, cursor: "pointer" }}
                      onClick={() => onFocusTrigger(t.id)}
                    >
                      <span className="trigger-title">{t.title}</span>
                      <span className="trigger-date">{t.date}</span>
                    </div>
                    <button
                      className="btn-icon small danger"
                      style={{
                        color: "#ef4444",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "0.7rem",
                        marginLeft: "8px",
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Cascade delete: find all connected events from this trigger
                        const connectedIds = new Set<string>([t.id]);
                        let changed = true;
                        while (changed) {
                          changed = false;
                          for (const edge of edges) {
                            if (
                              connectedIds.has(edge.sourceId) &&
                              !connectedIds.has(edge.targetId)
                            ) {
                              // Only add events, not entities
                              const targetEvent = events.find(
                                (ev) => ev.id === edge.targetId
                              );
                              if (targetEvent) {
                                connectedIds.add(edge.targetId);
                                changed = true;
                              }
                            }
                          }
                        }
                        // Find all edges connected to these events
                        const connectedEdges = edges.filter(
                          (e) =>
                            connectedIds.has(e.sourceId) ||
                            connectedIds.has(e.targetId)
                        );
                        // Delete all
                        await db.transact([
                          ...connectedEdges.map((e) => tx.edges[e.id].delete()),
                          ...Array.from(connectedIds).map((id) =>
                            tx.events[id].delete()
                          ),
                        ]);
                      }}
                      title="Delete trigger and all connected events"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="section-header">
              <h2>🏢 Entities</h2>
              <span className="count-badge">{entities.length}</span>
            </div>
            {entities.length === 0 ? (
              <p className="empty-message">No entities yet</p>
            ) : (
              <ul className="trigger-list">
                {entities.map((e) => (
                  <li
                    key={e.id}
                    className="trigger-item"
                    onClick={() => onSelectEntity?.(e.id)}
                  >
                    <span className="trigger-title">{e.name}</span>
                    <span className="trigger-date">{e.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {selected && (
        <section className="sidebar-section event-details">
          <div className="section-header">
            <h2>Edit Event</h2>
            <button
              className="btn-icon danger"
              onClick={() => {
                const deleteTx = [
                  ...edges
                    .filter(
                      (e) =>
                        e.sourceId === selected.id || e.targetId === selected.id
                    )
                    .map((e) => tx.edges[e.id].delete()),
                  tx.events[selected.id].delete(),
                ];
                db.transact(deleteTx);
              }}
              title="Delete Event"
            >
              🗑️
            </button>
          </div>
          <div className="event-card">
            <label className="field-label">Title</label>
            <input
              type="text"
              className="input"
              value={selected.title}
              onChange={(e) =>
                updateEvent(selected.id, selected, { title: e.target.value })
              }
            />

            <label className="field-label">Date</label>
            <input
              type="date"
              className="input"
              value={selected.date}
              onChange={(e) =>
                updateEvent(selected.id, selected, { date: e.target.value })
              }
            />

            <label className="field-label">Description</label>
            <textarea
              className="input textarea"
              rows={3}
              value={selected.description}
              placeholder="Add details..."
              onChange={(e) =>
                updateEvent(selected.id, selected, {
                  description: e.target.value,
                })
              }
            />

            <label className="checkbox-label" style={{ marginTop: "8px" }}>
              <input
                type="checkbox"
                checked={selected.isTrigger}
                onChange={(e) =>
                  updateEvent(selected.id, selected, {
                    isTrigger: e.target.checked,
                  })
                }
              />
              Is a trigger
            </label>
          </div>
        </section>
      )}

      {selectedEntity && (
        <section className="sidebar-section event-details">
          <div className="section-header">
            <h2>Edit Entity</h2>
            <button
              className="btn-icon danger"
              onClick={() => deleteEntity(selectedEntity.id, selectedEntity)}
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
              value={selectedEntity.name}
              onChange={(e) =>
                updateEntity(selectedEntity.id, selectedEntity, {
                  name: e.target.value,
                })
              }
            />

            <label className="field-label">Type</label>
            <input
              type="text"
              className="input"
              value={selectedEntity.type}
              onChange={(e) =>
                updateEntity(selectedEntity.id, selectedEntity, {
                  type: e.target.value,
                })
              }
            />

            <div className="properties-section">
              <label className="field-label">Properties</label>
              <div className="props-list">
                {Object.entries(selectedEntity.properties || {}).map(
                  ([k, v]) => (
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
                      <span
                        className="prop-key"
                        style={{ color: "#a78bfa", fontWeight: 500 }}
                      >
                        {k}:
                      </span>
                      <span
                        className="prop-value"
                        style={{ color: "#e2e8f0", flex: 1 }}
                      >
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
                        onClick={() => {
                          const newProps = { ...selectedEntity.properties };
                          delete newProps[k];
                          updateEntity(selectedEntity.id, selectedEntity, {
                            properties: newProps,
                          });
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )
                )}
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
                <button
                  className="btn btn-secondary small"
                  onClick={() => {
                    if (!newPropKey.trim() || !newPropValue.trim()) return;
                    updateEntity(selectedEntity.id, selectedEntity, {
                      properties: {
                        ...selectedEntity.properties,
                        [newPropKey.trim()]: newPropValue.trim(),
                      },
                    });
                    setNewPropKey("");
                    setNewPropValue("");
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Link to Event Section */}
            <div
              className="link-section"
              style={{
                marginTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "16px",
              }}
            >
              <label className="field-label">Link to Event</label>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <select
                  className="input"
                  style={{ flex: 1 }}
                  id="link-event-select"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select an event...
                  </option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-secondary small"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    const select = document.getElementById(
                      "link-event-select"
                    ) as HTMLSelectElement;
                    const eventId = select?.value;
                    if (eventId && selectedEntity) {
                      createEdge(selectedEntity.id, eventId, "", "causal");
                      select.value = "";
                    }
                  }}
                >
                  🔗 Link
                </button>
              </div>
              {/* Show existing connections */}
              {edges.filter((e) => e.sourceId === selectedEntity.id).length >
                0 && (
                <div style={{ marginTop: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Connected to:
                  </span>
                  <ul style={{ margin: "4px 0", padding: "0 0 0 16px" }}>
                    {edges
                      .filter((e) => e.sourceId === selectedEntity.id)
                      .map((edge) => {
                        const targetEvent = events.find(
                          (ev) => ev.id === edge.targetId
                        );
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
      )}

      {selectedEdge && (
        <section className="sidebar-section event-details">
          <div className="section-header">
            <h2>Edit Connection</h2>
            <button
              className="btn-icon danger"
              onClick={() => {
                deleteEdge(selectedEdge.id, selectedEdge);
              }}
              title="Delete Connection"
            >
              🗑️
            </button>
          </div>
          <div className="event-card">
            <label className="field-label">Type</label>
            <div className="button-group">
              <button
                className={`btn ${
                  selectedEdge.edgeType !== "simultaneous"
                    ? "btn-primary"
                    : "btn-secondary"
                }`}
                onClick={() =>
                  updateEdge(selectedEdge.id, selectedEdge, {
                    edgeType: "causal",
                  })
                }
              >
                Causal
              </button>
              <button
                className={`btn ${
                  selectedEdge.edgeType === "simultaneous"
                    ? "btn-primary"
                    : "btn-secondary"
                }`}
                onClick={() =>
                  updateEdge(selectedEdge.id, selectedEdge, {
                    edgeType: "simultaneous",
                  })
                }
              >
                Simultaneous
              </button>
            </div>

            <label className="field-label">Label</label>
            <div
              className="label-suggestions"
              style={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                marginBottom: "12px",
              }}
            >
              {[
                {
                  label: "led to",
                  color: "#3b82f6",
                  bg: "rgba(59, 130, 246, 0.15)",
                },
                {
                  label: "triggered",
                  color: "#ef4444",
                  bg: "rgba(239, 68, 68, 0.15)",
                },
                {
                  label: "caused",
                  color: "#f97316",
                  bg: "rgba(249, 115, 22, 0.15)",
                },
                {
                  label: "concurrent with",
                  color: "#a855f7",
                  bg: "rgba(168, 85, 247, 0.15)",
                },
              ]
                .map((preset) => {
                  return preset;
                })
                .concat(
                  customLabels
                    .filter(
                      (l) =>
                        ![
                          "led to",
                          "triggered",
                          "caused",
                          "concurrent with",
                        ].includes(l)
                    )
                    .map((l) => ({
                      label: l,
                      color: "#94a3b8",
                      bg: "rgba(148, 163, 184, 0.15)",
                    }))
                )
                .map(({ label, color, bg }) => (
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
                    onClick={() =>
                      updateEdge(selectedEdge.id, selectedEdge, {
                        label: label,
                      })
                    }
                  >
                    <span
                      style={{
                        color: color,
                        marginRight: "4px",
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomLabels((prev) =>
                          prev.filter((l) => l !== label)
                        );
                      }}
                      className="btn-icon small"
                      style={{
                        padding: "2px",
                        fontSize: "0.65rem",
                        color: color,
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
              value={selectedEdge.label}
              placeholder="Type label and press Enter to save..."
              onChange={(e) =>
                updateEdge(selectedEdge.id, selectedEdge, {
                  label: e.target.value,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && selectedEdge.label.trim()) {
                  const val = selectedEdge.label.trim();
                  if (!customLabels.includes(val)) {
                    setCustomLabels([...customLabels, val]);
                  }
                }
              }}
            />
          </div>
        </section>
      )}

      <section className="sidebar-section">
        <h2>Actions</h2>
        {showForm ? (
          <div className="add-form">
            {activeTab === "timeline" ? (
              <>
                <input
                  type="text"
                  placeholder="Title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isTrigger}
                    onChange={(e) => setIsTrigger(e.target.checked)}
                  />
                  Is a trigger
                </label>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Name (e.g. SVB)"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Type (e.g. Bank)"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="input"
                />
              </>
            )}
            <div className="button-group">
              <button onClick={handleAdd} className="btn btn-primary">
                Add {activeTab === "timeline" ? "Event" : "Entity"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="button-group vertical">
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              + Add {activeTab === "timeline" ? "Event" : "Entity"}
            </button>
            {activeTab === "timeline" &&
              // Load Example button removed (moved to script)
              null}
            {(events.length > 0 || entities.length > 0) && (
              <button onClick={handleClear} className="btn btn-danger">
                🗑️ Clear All
              </button>
            )}
          </div>
        )}
      </section>

      <section className="sidebar-section user-info">
        <h2>You</h2>
        <div className="user-card">
          <div
            className="user-avatar"
            style={{ backgroundColor: context.userColor }}
          >
            {context.userName[0]}
          </div>
          <span className="user-name">{context.userName}</span>
        </div>
      </section>

      <footer className="sidebar-footer">
        <p className="stats">
          {events.length} events · {edges.length} connections
        </p>
      </footer>
    </aside>
  );
};

export default Sidebar;
