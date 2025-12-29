// History Utility Constants and Functions

import type { EditHistoryEntry } from "../types";

export const actionLabels: Record<EditHistoryEntry["action"], string> = {
  create_event: "Created event",
  update_event: "Updated event",
  delete_event: "Deleted event",
  create_entity: "Created entity",
  update_entity: "Updated entity",
  delete_entity: "Deleted entity",
  create_edge: "Linked events",
  update_edge: "Updated link",
  delete_edge: "Removed link",
  bulk_import: "Imported Sample Data",
};

export const actionIcons: Record<EditHistoryEntry["action"], string> = {
  create_event: "➕",
  update_event: "✏️",
  delete_event: "🗑️",
  create_entity: "🏢",
  update_entity: "📝",
  delete_entity: "🗑️",
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
