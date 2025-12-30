// Sidebar - Main component with panels

import { useState, useCallback } from "react";
import { useGraph } from "../../db";
import { db, tx } from "../../db";
import type { Event, Edge, Entity, SidebarProps } from "../../types";
import { EventPanel } from "./EventPanel";
import { EntityPanel } from "./EntityPanel";
import { EdgePanel } from "./EdgePanel";
import { EntityTree } from "./EntityTree";

const Sidebar = ({
  context,
  onFocusTrigger,
  onFocusEntity,
  onSelectEvent,
  onSelectEntity,
  onSelectEdge,
  showEntities,
  onToggleEntities,
  showTriggersOnGraph,
  setShowTriggersOnGraph,
  showNonTriggersOnGraph,
  setShowNonTriggersOnGraph,
}: SidebarProps) => {
  const { events, entities, edges } = useGraph();
  const [showEventsSection, setShowEventsSection] = useState(true);
  const [showEntitiesSection, setShowEntitiesSection] = useState(true);
  const [showTriggersSubsection, setShowTriggersSubsection] = useState(true);
  const [showEventsSubsection, setShowEventsSubsection] = useState(true);
  const [showForm, setShowForm] = useState<"event" | "trigger" | "entity" | null>(null);

  const triggers = events.filter((e) => e.isTrigger);
  const nonTriggerEvents = events.filter((e) => !e.isTrigger);
  const selected = events.find((e) => e.id === context.selectedEventId);
  const selectedEntity = entities.find((e) => e.id === context.selectedEntityId);
  const selectedEdge = edges.find((e) => e.id === context.selectedEdgeId);

  // Check if selected edge is entity-event edge
  const entityIds = entities.map((e) => e.id);
  const isEntityEdge =
    selectedEdge &&
    (entityIds.includes(selectedEdge.sourceId) || entityIds.includes(selectedEdge.targetId));

  // Check if anything is selected (editing mode) - include ALL edges and add forms
  const isEditing = selected || selectedEntity || selectedEdge || showForm !== null;

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
        <h1>📊 Financial Graph</h1>
      </header>

      {!isEditing && (
        <>
          {/* Events Section */}
          <section className="sidebar-section">
            <div
              className="section-header clickable"
              onClick={() => setShowEventsSection(!showEventsSection)}
            >
              <span className="collapse-icon">{showEventsSection ? "▼" : "▶"}</span>
              <h2>🔴 Events</h2>
              <span className="count-badge">{events.length}</span>
            </div>
            {showEventsSection && (
              <div className="section-content">
                {/* Triggers Subsection */}
                <div className="subsection">
                  <div
                    className="subsection-header clickable"
                    onClick={() => setShowTriggersSubsection(!showTriggersSubsection)}
                  >
                    <span className="collapse-icon">{showTriggersSubsection ? "▼" : "▶"}</span>
                    <h3>Triggers</h3>
                    <span className="count-badge">{triggers.length}</span>
                    <button
                      className={`eye-toggle ${showTriggersOnGraph ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTriggersOnGraph(!showTriggersOnGraph);
                      }}
                      title="Toggle triggers on graph"
                    >
                      {showTriggersOnGraph ? "👁️" : "👁️‍🗨️"}
                    </button>
                    <button
                      className="add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowForm("trigger");
                      }}
                      title="Add trigger"
                    >
                      +
                    </button>
                  </div>
                  {showTriggersSubsection && (
                    <>
                      {triggers.length === 0 ? (
                        <p className="empty-message">No triggers yet</p>
                      ) : (
                        <ul className="trigger-list">
                          {triggers.map((trigger) => (
                            <li
                              key={trigger.id}
                              className={`trigger-item ${
                                context.focusedTriggerId === trigger.id ? "focused" : ""
                              }`}
                              style={{ position: "relative" }}
                              onClick={() => onFocusTrigger(trigger.id)}
                            >
                              <span className="trigger-title">{trigger.title}</span>
                              <span className="trigger-date">{trigger.date}</span>
                              <button
                                className="three-dots-menu"
                                style={{
                                  position: "absolute",
                                  top: "4px",
                                  right: "4px",
                                  background: "transparent",
                                  border: "none",
                                  color: "#94a3b8",
                                  fontSize: "1rem",
                                  padding: "2px 4px",
                                  cursor: "pointer",
                                  opacity: 0.6,
                                  lineHeight: 1,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectEvent?.(trigger.id);
                                }}
                                title="Edit trigger"
                              >
                                ⋮
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>

                {/* Non-Trigger Events Subsection */}
                {nonTriggerEvents.length > 0 && (
                  <div className="subsection">
                    <div
                      className="subsection-header clickable"
                      onClick={() => setShowEventsSubsection(!showEventsSubsection)}
                    >
                      <span className="collapse-icon">{showEventsSubsection ? "▼" : "▶"}</span>
                      <h3>Events</h3>
                      <span className="count-badge">{nonTriggerEvents.length}</span>
                      <button
                        className={`eye-toggle ${showNonTriggersOnGraph ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNonTriggersOnGraph(!showNonTriggersOnGraph);
                        }}
                        title="Toggle events on graph"
                      >
                        {showNonTriggersOnGraph ? "👁️" : "👁️‍🗨️"}
                      </button>
                      <button
                        className="add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowForm("event");
                        }}
                        title="Add event"
                      >
                        +
                      </button>
                    </div>
                    {showEventsSubsection && (
                      <ul className="trigger-list">
                        {nonTriggerEvents.map((evt) => (
                          <li
                            key={evt.id}
                            className={`trigger-item ${
                              context.selectedEventId === evt.id ? "focused" : ""
                            }`}
                            style={{ position: "relative" }}
                          >
                            <span className="trigger-title">{evt.title}</span>
                            <span className="trigger-date">{evt.date}</span>
                            <button
                              className="three-dots-menu"
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                background: "transparent",
                                border: "none",
                                color: "#94a3b8",
                                fontSize: "1rem",
                                padding: "2px 4px",
                                cursor: "pointer",
                                opacity: 0.6,
                                lineHeight: 1,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent?.(evt.id);
                              }}
                              title="Edit event"
                            >
                              ⋮
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Entities Section */}
          <section className="sidebar-section">
            <div
              className="section-header clickable"
              onClick={() => setShowEntitiesSection(!showEntitiesSection)}
            >
              <span className="collapse-icon">{showEntitiesSection ? "▼" : "▶"}</span>
              <h2>🏢 Entities</h2>
              <span className="count-badge">{entities.length}</span>
              <button
                className={`eye-toggle ${showEntities ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEntities();
                }}
                title="Toggle entities on graph"
              >
                {showEntities ? "👁️" : "👁️‍🗨️"}
              </button>
              <button
                className="add-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowForm("entity");
                }}
                title="Add entity"
              >
                +
              </button>
            </div>
            {showEntitiesSection && (
              <div className="section-content">
                <EntityTree
                  entities={entities}
                  edges={edges}
                  context={context}
                  onFocusEntity={onFocusEntity}
                  onSelectEntity={onSelectEntity}
                />
              </div>
            )}
          </section>
        </>
      )}

      {/* Editing Panels */}
      {selected && (
        <EventPanel event={selected} edges={edges} onCancel={() => onSelectEvent?.(null)} />
      )}
      {selectedEntity && (
        <EntityPanel
          entity={selectedEntity}
          events={events}
          edges={edges}
          onCancel={() => onSelectEntity?.(null)}
        />
      )}
      {selectedEdge && (
        <EdgePanel
          edge={selectedEdge}
          isEntityEdge={!!isEntityEdge}
          onCancel={() => onSelectEdge?.(null)}
        />
      )}

      {/* Add Event/Entity Panels */}
      {showForm === "trigger" && (
        <EventPanel
          edges={edges}
          onCancel={() => setShowForm(null)}
          mode="add"
          defaultIsTrigger={true}
        />
      )}
      {showForm === "event" && (
        <EventPanel
          edges={edges}
          onCancel={() => setShowForm(null)}
          mode="add"
          defaultIsTrigger={false}
        />
      )}
      {showForm === "entity" && (
        <EntityPanel
          events={events}
          edges={edges}
          onCancel={() => setShowForm(null)}
          mode="add"
        />
      )}

      {/* Actions Section - Only show when not editing */}
      {!isEditing && !showForm && (events.length > 0 || entities.length > 0) && (
        <section className="sidebar-section actions-section">
          <div className="section-header">
            <h2>Actions</h2>
          </div>
          <div className="button-group vertical">
            <button onClick={handleClear} className="btn btn-danger btn-compact">
              🗑️ Clear All
            </button>
          </div>
        </section>
      )}

      {!isEditing && !showForm && (
        <footer className="sidebar-footer">
          <p className="stats">
            {events.length} events · {entities.length} entities · {edges.length} connections
          </p>
        </footer>
      )}
    </aside>
  );
};

export default Sidebar;
