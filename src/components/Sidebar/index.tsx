// Sidebar - Main component with panels

import { useState, useCallback } from "react";
import { useGraph } from "../../db";
import { db, tx } from "../../db";
import type { Event, Edge, Entity, SidebarProps } from "../../types";
import { EventPanel } from "./EventPanel";
import { EntityPanel } from "./EntityPanel";
import { EdgePanel } from "./EdgePanel";
import { EventForm } from "./EventForm";
import { EntityForm } from "./EntityForm";

const Sidebar = ({
  context,
  onFocusTrigger,
  onSelectEvent,
  onSelectEntity,
  onSelectEdge,
  showActors,
  onToggleActors,
}: SidebarProps) => {
  const { events, entities, edges } = useGraph();
  const [activeTab, setActiveTab] = useState<"timeline" | "actors">("timeline");
  const [showForm, setShowForm] = useState(false);

  const triggers = events.filter((e) => e.isTrigger);
  const selected = events.find((e) => e.id === context.selectedEventId);
  const selectedEntity = entities.find((e) => e.id === context.selectedEntityId);
  const selectedEdge = edges.find((e) => e.id === context.selectedEdgeId);

  // Check if selected edge is entity-event edge
  const entityIds = entities.map((e) => e.id);
  const isEntityEdge = selectedEdge && (entityIds.includes(selectedEdge.sourceId) || entityIds.includes(selectedEdge.targetId));

  // Check if anything is selected (editing mode) - include ALL edges
  const isEditing = selected || selectedEntity || selectedEdge;

  const handleClear = useCallback(async () => {
    await db.transact([
      ...edges.map((e: Edge) => tx.edges[e.id].delete()),
      ...events.map((e: Event) => tx.events[e.id].delete()),
      ...entities.map((e: Entity) => tx.entities[e.id].delete()),
    ]);
  }, [events, edges, entities]);

  const handleDeleteTrigger = async (trigger: Event) => {
    const connectedIds = new Set<string>([trigger.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) {
        if (connectedIds.has(edge.sourceId) && !connectedIds.has(edge.targetId)) {
          const targetEvent = events.find((ev) => ev.id === edge.targetId);
          if (targetEvent) {
            connectedIds.add(edge.targetId);
            changed = true;
          }
        }
      }
    }
    const connectedEdges = edges.filter(
      (e) => connectedIds.has(e.sourceId) || connectedIds.has(e.targetId)
    );
    await db.transact([
      ...connectedEdges.map((e) => tx.edges[e.id].delete()),
      ...Array.from(connectedIds).map((id) => tx.events[id].delete()),
    ]);
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>💥 Failure Tracker</h1>
        {!isEditing && (
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
                onToggleActors();
              }}
            >
              Actors {showActors ? "👁️" : ""}
            </button>
          </div>
        )}
      </header>

      {!isEditing && (
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
                    className={`trigger-item ${context.focusedTriggerId === t.id ? "focused" : ""}`}
                    style={{ position: "relative" }}
                    onClick={() => onFocusTrigger(t.id)}
                  >
                    <span className="trigger-title">{t.title}</span>
                    <span className="trigger-date">{t.date}</span>
                    <button
                      className="delete-x"
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        padding: "2px 4px",
                        cursor: "pointer",
                        opacity: 0.6,
                        lineHeight: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrigger(t);
                      }}
                      title="Delete trigger and all connected events"
                    >
                      ✕
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
                  <li key={e.id} className="trigger-item" onClick={() => onSelectEntity?.(e.id)}>
                    <span className="trigger-title">{e.name}</span>
                    <span className="trigger-date">{e.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        </section>
      )}

      {/* Editing Panels */}
      {selected && <EventPanel event={selected} edges={edges} onCancel={() => onSelectEvent?.(null)} />}
      {selectedEntity && <EntityPanel entity={selectedEntity} events={events} edges={edges} onCancel={() => onSelectEntity?.(null)} />}
      {selectedEdge && <EdgePanel edge={selectedEdge} isEntityEdge={!!isEntityEdge} onCancel={() => onSelectEdge?.(null)} />}

      {/* Actions Section - Only show when not editing */}
      {!isEditing && (
        <section className="sidebar-section actions-section">
          <div className="section-header">
            <h2>Actions</h2>
          </div>
          {showForm ? (
            activeTab === "timeline" ? (
              <EventForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
            ) : (
              <EntityForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
            )
          ) : (
            <div className="button-group vertical">
              <button onClick={() => setShowForm(true)} className="btn btn-primary btn-compact">
                + Add {activeTab === "timeline" ? "Event" : "Entity"}
              </button>
              {(events.length > 0 || entities.length > 0) && (
                <button onClick={handleClear} className="btn btn-danger btn-compact">
                  🗑️ Clear All
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {!isEditing && (
        <footer className="sidebar-footer">
          <p className="stats">
            {events.length} events · {edges.length} connections
          </p>
        </footer>
      )}
    </aside>
  );
};

export default Sidebar;
