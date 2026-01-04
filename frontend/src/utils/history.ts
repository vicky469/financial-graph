// History Utility Constants and Functions

import type { EditHistoryEntry } from "../types";

export const actionLabels: Record<EditHistoryEntry["action"], string> = {
  create_node: "Created node",
  update_node: "Updated node",
  delete_node: "Deleted node",
  create_edge: "Linked nodes",
  update_edge: "Updated link",
  delete_edge: "Removed link",
  bulk_import: "Imported Sample Data",
};

export const actionIcons: Record<EditHistoryEntry["action"], string> = {
  create_node: "🏢",
  update_node: "📝",
  delete_node: "🗑️",
  create_edge: "🔗",
  update_edge: "🔧",
  delete_edge: "✂️",
  bulk_import: "📚",
};

export const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

interface FieldChange {
  field: string;
  from: string;
  to: string;
}

const TRUNCATE_LENGTH = 50;

const truncate = (str: string, maxLength: number = TRUNCATE_LENGTH): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const formatFieldName = (field: string): string => {
  // Convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

/**
 * Get a summary of what changed in an edit history entry
 * Returns an array of field changes with from/to values
 */
export const getChangeSummary = (entry: EditHistoryEntry): FieldChange[] => {
  const changes: FieldChange[] = [];

  // Only show changes for update actions
  if (!entry.action.startsWith("update_")) {
    return changes;
  }

  if (!entry.previousData || !entry.newData) {
    return changes;
  }

  const prev = entry.previousData as Record<string, unknown>;
  const next = entry.newData as Record<string, unknown>;

  // Only iterate over keys that were actually updated (exist in newData)
  for (const key of Object.keys(next)) {
    // Skip metadata fields
    if (["id", "createdAt", "createdBy"].includes(key)) continue;

    const prevValue = prev[key];
    const nextValue = next[key];

    // Check if value actually changed (and both values exist)
    if (prevValue !== undefined && JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      changes.push({
        field: formatFieldName(key),
        from: truncate(formatValue(prevValue)),
        to: truncate(formatValue(nextValue)),
      });
    }
  }

  return changes;
};
