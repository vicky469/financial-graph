// Entity editing panel component

import { useState, useRef, useEffect, useCallback } from "react";
import { updateEntity, deleteEntity, createEntity, createEdge, deleteEdge } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Entity, Event, Edge } from "../../types";

interface EntityPanelProps {
  entity?: Entity;
  events: Event[];
  edges: Edge[];
  onCancel: () => void;
  mode?: "add" | "edit";
}

const emptyEntity: Partial<Entity> = {
  name: "",
  type: "",
  properties: {},
};

export function EntityPanel({ entity, events, edges, onCancel, mode = "edit" }: EntityPanelProps) {
  const initialEntity = entity || emptyEntity;
  const [localEntity, setLocalEntity] = useState<Partial<Entity>>(initialEntity);
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");
  const previousEntityRef = useRef(initialEntity);
  const pendingChangesRef = useRef<Partial<Entity>>({});
  const panelRef = useRef<HTMLElement>(null);

  const connectedEdges = entity ? edges.filter((e) => e.sourceId === entity.id) : [];
  const unconnectedEvents = entity
    ? events.filter((evt) => !edges.some((e) => e.sourceId === entity.id && e.targetId === evt.id))
    : events;

  const savePendingChanges = useCallback(async () => {
    if (mode === "add") {
      // Create new entity
      if (localEntity.name && localEntity.type) {
        await createEntity({
          name: localEntity.name,
          type: localEntity.type,
          properties: localEntity.properties || {},
        });
      }
    } else {
      // Update existing entity
      const changes = pendingChangesRef.current;
      if (Object.keys(changes).length > 0 && entity) {
        await updateEntity(entity.id, previousEntityRef.current as Entity, changes);
        previousEntityRef.current = { ...previousEntityRef.current, ...changes };
        pendingChangesRef.current = {};
      }
    }
  }, [mode, localEntity, entity]);

  const handleSaveAndClose = useCallback(async () => {
    await savePendingChanges();
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

  // Update local state when entity prop changes
  useEffect(() => {
    if (entity) {
      setLocalEntity(entity);
      previousEntityRef.current = entity;
      pendingChangesRef.current = {};
    }
  }, [entity?.id]);

  const handleChange = (updates: Partial<Entity>) => {
    setLocalEntity((prev) => ({ ...prev, ...updates }));
    // Track pending changes (only in edit mode)
    if (mode === "edit") {
      pendingChangesRef.current = { ...pendingChangesRef.current, ...updates };
    }
  };

  const handleAddProperty = () => {
    if (!newPropKey.trim() || !newPropValue.trim()) return;
    handleChange({
      properties: {
        ...localEntity.properties,
        [newPropKey.trim()]: newPropValue.trim(),
      },
    });
    setNewPropKey("");
    setNewPropValue("");
  };

  const handleDeleteProperty = (key: string) => {
    const newProps = { ...localEntity.properties };
    delete newProps[key];
    handleChange({ properties: newProps });
  };

  const handleCancel = () => {
    pendingChangesRef.current = {};
    onCancel();
  };

  const handleLinkSelected = () => {
    if (!entity) return; // Can't link in add mode
    const checkboxes = document.querySelectorAll(
      ".link-event-checkbox:checked"
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
      createEdge(entity.id, cb.value, "", "causal");
      cb.checked = false;
    });
  };

  return (
    <section ref={panelRef} className="sidebar-section event-details">
      <div className="section-header">
        <h2>{mode === "add" ? "Add Entity" : "Edit Entity"}</h2>
        {mode === "edit" && entity && (
          <button
            className="btn-icon danger"
            onClick={() => deleteEntity(entity.id, entity)}
            title="Delete Entity"
          >
            🗑️
          </button>
        )}
      </div>
      <div className="event-card">
        <label className="field-label">Name</label>
        <input
          type="text"
          className="input"
          value={localEntity.name}
          onChange={(e) => handleChange({ name: e.target.value })}
        />

        <label className="field-label">Type</label>
        <input
          type="text"
          className="input"
          value={localEntity.type}
          onChange={(e) => handleChange({ type: e.target.value })}
        />

        {/* Properties Section */}
        <div className="properties-section">
          <label className="field-label">Properties</label>
          <div className="props-list">
            {Object.entries(localEntity.properties || {}).map(([k, v]) => (
              <div key={k} className="prop-row">
                <span className="prop-key">{k}:</span>
                <span className="prop-value">{v}</span>
                <button className="btn-icon small prop-delete" onClick={() => handleDeleteProperty(k)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="add-prop-row">
            <input
              placeholder="Key"
              value={newPropKey}
              onChange={(e) => setNewPropKey(e.target.value)}
              className="input"
            />
            <input
              placeholder="Value"
              value={newPropValue}
              onChange={(e) => setNewPropValue(e.target.value)}
              className="input"
            />
            <button className="btn btn-secondary small" onClick={handleAddProperty}>
              Add
            </button>
          </div>
        </div>

        {/* Link to Events Section - only in edit mode */}
        {mode === "edit" && (
          <div className="link-section">
            <label className="field-label">Link to Events</label>
            <div className="link-events-list">
              {unconnectedEvents.map((evt) => (
                <label key={evt.id} className="link-event-item">
                  <input type="checkbox" className="link-event-checkbox" value={evt.id} />
                  <span>{evt.title}</span>
                </label>
              ))}
            </div>
            <button className="btn btn-secondary small" onClick={handleLinkSelected}>
              Link Selected
            </button>

            {/* Show existing connections */}
            {connectedEdges.length > 0 && (
              <div className="connected-list">
                <span className="connected-label">Connected to:</span>
                <ul className="connected-items">
                  {connectedEdges.map((edge) => {
                    const targetEvent = events.find((ev) => ev.id === edge.targetId);
                    return targetEvent ? (
                      <li key={edge.id} className="connected-item">
                        <span>{targetEvent.title}</span>
                        <button
                          className="btn-icon small"
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
        )}

        <div className="button-group action-buttons">
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

export default EntityPanel;
