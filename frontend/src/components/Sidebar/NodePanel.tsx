// Node editing panel component

import { useState, useRef, useEffect, useCallback } from "react";
import { createNode, updateNode, deleteNode } from "../../db";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { Node, PropertyValue } from "../../types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, X } from "lucide-react";
import { GICS } from "@/types/sec";

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
          const now = Date.now();
          await createNode({
            name: localNode.name,
            type: localNode.type,
            properties: localNode.properties || {},
            updatedAt: now,
            updatedBy: "user", // This should ideally come from context
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

  const handlePropertyChange = (key: string, value: PropertyValue) => {
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
    <section ref={panelRef} className="node-panel">
      <ScrollArea className="node-panel-scroll">
        <div className="node-panel-content">
          {/* Header */}
          <div className="node-panel-header">
            <h2 className="node-panel-title">{mode === "add" ? "Add Node" : "Edit Node"}</h2>
            {mode === "edit" && node && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteNode(node.id, node)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Form Fields */}
          <div className="node-panel-form">
            <div className="form-field">
              <label className="form-label">Name</label>
              <Input
                value={localNode.name}
                onChange={(e) => handleChange({ name: e.target.value })}
                placeholder="Node Name"
                autoFocus
              />
            </div>

            <div className="form-field">
              <label className="form-label">URL</label>
              <Input
                value={localNode.url || ""}
                onChange={(e) => handleChange({ url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            {/* Company-specific direct fields */}
            {localNode.type === "Company" && (
              <>
                <div className="form-field">
                  <label className="form-label">CIK</label>
                  <Input
                    value={localNode.cik || ""}
                    onChange={(e) => handleChange({ cik: e.target.value })}
                    placeholder="Central Index Key"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Jurisdiction</label>
                  <Input
                    value={localNode.jurisdiction || ""}
                    onChange={(e) => handleChange({ jurisdiction: e.target.value })}
                    placeholder="e.g., Delaware, US-DE"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Company Group ID</label>
                  <Input
                    value={localNode.companyGroupId || ""}
                    onChange={(e) => handleChange({ companyGroupId: e.target.value })}
                    placeholder="UUID of ultimate parent"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Primary Sector (GICS)</label>
                  <Select
                    value={localNode.sector?.toString() || ""}
                    onValueChange={(value) =>
                      handleChange({ sector: value ? (Number(value) as GICS) : null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(GICS).map(([key, value]) => (
                        <SelectItem key={value} value={value.toString()}>
                          {key.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-field">
                  <label className="form-label">Business Segments</label>
                  <Input
                    value={localNode.segments?.join(", ") || ""}
                    onChange={(e) =>
                      handleChange({
                        segments: e.target.value
                          ? e.target.value.split(",").map((s) => s.trim())
                          : [],
                      })
                    }
                    placeholder="e.g., Retail, Cloud, Gaming"
                  />
                </div>
              </>
            )}

            {/* Brand-specific fields */}
            {localNode.type === "Brand" && (
              <>
                <div className="form-field">
                  <label className="form-label">Brand Type</label>
                  <Select
                    value={(localNode.properties?.brand_type as string) || ""}
                    onValueChange={(value) =>
                      handlePropertyChange("brand_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="trademark">Trademark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-field">
                  <label className="form-label">Company ID</label>
                  <Input
                    value={(localNode.properties?.company_id as string) || ""}
                    onChange={(e) => handlePropertyChange("company_id", e.target.value)}
                    placeholder="UUID of owning legal entity"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Category</label>
                  <Input
                    value={(localNode.properties?.category as string) || ""}
                    onChange={(e) => handlePropertyChange("category", e.target.value)}
                    placeholder="e.g., Gaming Console, Social Media App, Fast Food"
                  />
                </div>
              </>
            )}

            <Separator className="my-4" />

            {/* Properties Section */}
            <div className="form-field">
              <div className="form-label-row">
                <label className="form-label">Properties</label>
                <Button variant="ghost" size="icon" onClick={addProperty} className="h-6 w-6">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="properties-list">
                {Object.entries(localNode.properties || {}).map(([k, v]) => (
                  <div key={k} className="prop-row">
                    <Input
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
                      className="h-8 text-xs"
                      placeholder="Key"
                    />
                    <Input
                      value={v as string}
                      onChange={(e) => handlePropertyChange(k, e.target.value)}
                      className="h-8 text-xs"
                      placeholder="Value"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProperty(k)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="add-prop-row">
                <Input
                  placeholder="Key"
                  value={newPropKey}
                  onChange={(e) => setNewPropKey(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Value"
                  value={newPropValue}
                  onChange={(e) => setNewPropValue(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button variant="secondary" size="sm" onClick={handleAddProperty} className="h-8">
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="node-panel-actions">
            <Button onClick={handleSaveAndClose}>Save</Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}

export default NodePanel;
