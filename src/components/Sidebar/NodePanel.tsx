// Node editing panel component

import { useState, useRef, useEffect, useCallback } from "react";
import { createNode, updateNode, deleteNode, createEdge, deleteEdge } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Node, Event, Edge } from "../../types";

interface NodePanelProps {
  node?: Node;
  events: Event[];
  edges: Edge[];
  onCancel: () => void;
  mode?: "add" | "edit";
}

const emptyNode: Partial<Node> = {
  name: "",
  type: "Company",
  properties: {},
};

export function NodePanel({ node, events, edges, onCancel, mode = "edit" }: NodePanelProps) {
  const initialNode = node || emptyNode;
  const [localNode, setLocalNode] = useState<Partial<Node>>(initialNode);
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");
  const previousNodeRef = useRef(initialNode);
  const pendingChangesRef = useRef<Partial<Node>>({});
  const panelRef = useRef<HTMLElement>(null);

  const connectedEdges = node ? edges.filter((e) => e.sourceId === node.id) : [];
  const unconnectedEvents = node
    ? events.filter((evt) => !edges.some((e) => e.sourceId === node.id && e.targetId === evt.id))
    : events;

  const savePendingChanges = useCallback(async () => {
    try {
      if (localNode.name && localNode.type) {
        if (mode === "add") {
          await createNode({
            name: localNode.name,
            type: localNode.type,
            properties: localNode.properties || {},
          });
        } else if (node) {
          // Calculate changes
          const changes: Partial<Node> = {};
          if (localNode.name !== previousNodeRef.current.name) changes.name = localNode.name;
          if (localNode.type !== previousNodeRef.current.type) changes.type = localNode.type;

          if (
            JSON.stringify(localNode.properties) !==
            JSON.stringify(previousNodeRef.current.properties)
          ) {
            changes.properties = localNode.properties;
          }

          if (Object.keys(changes).length > 0) {
            await updateNode(node.id, previousNodeRef.current as Node, changes);
            previousNodeRef.current = { ...previousNodeRef.current, ...changes };
          }
        }
        onCancel();
      }
    } catch (error) {
      console.error("Failed to save node:", error);
    }
  }, [mode, localNode, node, onCancel]);

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

  // Update local state when node prop changes
  useEffect(() => {
    if (node) {
      setLocalNode(node);
      previousNodeRef.current = node;
      pendingChangesRef.current = {};
    }
  }, [node?.id, node]);

  const handleChange = (updates: Partial<Node>) => {
    setLocalNode((prev) => ({ ...prev, ...updates }));
    // Track pending changes (only in edit mode)
    if (mode === "edit") {
      pendingChangesRef.current = { ...pendingChangesRef.current, ...updates };
    }
  };

  const handlePropertyChange = (key: string, value: string) => {
    setLocalNode((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value,
      },
    }));
  };

  const addProperty = () => {
    const key = `prop_${Object.keys(localNode.properties || {}).length + 1}`;
    setLocalNode((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: "",
      },
    }));
  };

  const handleAddProperty = () => {
    if (!newPropKey.trim() || !newPropValue.trim()) return;
    handleChange({
      properties: {
        ...localNode.properties,
        [newPropKey.trim()]: newPropValue.trim(),
      },
    });
    setNewPropKey("");
    setNewPropValue("");
  };

  const removeProperty = (key: string) => {
    const newProps = { ...localNode.properties };
    delete newProps[key];
    handleChange({ properties: newProps });
  };

  const handleCancel = () => {
    pendingChangesRef.current = {};
    onCancel();
  };

  const handleLinkSelected = () => {
    if (!node) return; // Can't link in add mode
    const checkboxes = document.querySelectorAll(
      ".link-event-checkbox:checked"
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
      createEdge(node.id, cb.value, "", "causal");
      cb.checked = false;
    });
  };

  return (
    <section ref={panelRef} className="sidebar-section event-details">
      <header className="panel-header">
        <h2>{mode === "add" ? "Add Node" : "Edit Node"}</h2>
        {mode === "edit" && node && (
          <button
            className="btn-icon danger"
            onClick={() => deleteNode(node.id, node)}
            title="Delete Node"
          >
            🗑️
          </button>
        )}
      </header>

      <div className="panel-content">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={localNode.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            placeholder="Node Name"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Type</label>
          <select value={localNode.type} onChange={(e) => handleChange({ type: e.target.value })}>
            <option value="Company">Company</option>
            <option value="Person">Person</option>
            <option value="Instrument">Instrument</option>
          </select>
        </div>

        <div className="properties-section">
          <div className="section-header">
            <h3>Properties</h3>
            <button className="btn-icon" onClick={addProperty} title="Add Property">
              +
            </button>
          </div>
          <div className="properties-list">
            {Object.entries(localNode.properties || {}).map(([k, v]) => (
              <div key={k} className="prop-row">
                <input
                  type="text"
                  value={k}
                  onChange={(e) => {
                    const newProps = { ...localNode.properties };
                    const oldKey = k;
                    const newKey = e.target.value;
                    if (oldKey !== newKey) {
                      newProps[newKey] = newProps[oldKey];
                      delete newProps[oldKey];
                      setLocalNode((prev) => ({ ...prev, properties: newProps }));
                    }
                  }}
                  className="input prop-key-input"
                />
                <input
                  type="text"
                  value={v as string}
                  onChange={(e) => handlePropertyChange(k, e.target.value)}
                  className="input prop-value-input"
                />
                <button className="btn-icon small prop-delete" onClick={() => removeProperty(k)}>
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
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="btn btn-primary btn-compact"
          >
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

export default NodePanel;
