// Node editing panel component

import { useState, useRef, useEffect, useCallback } from "react";
import { createNode, updateNode, deleteNode } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Node } from "../../types";

interface NodePanelProps {
  node?: Node;
  onCancel: () => void;
  mode?: "add" | "edit";
}

const emptyNode: Partial<Node> = {
  name: "",
  type: "Company",
  properties: {},
};

export function NodePanel({ node, onCancel, mode = "edit" }: NodePanelProps) {
  const initialNode = node || emptyNode;
  const [localNode, setLocalNode] = useState<Partial<Node>>(initialNode);
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");
  const previousNodeRef = useRef(initialNode);
  const pendingChangesRef = useRef<Partial<Node>>({});
  const panelRef = useRef<HTMLElement>(null);

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
          <label>URL</label>
          <input
            type="text"
            value={localNode.url || ""}
            onChange={(e) => handleChange({ url: e.target.value })}
            placeholder="https://example.com"
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
