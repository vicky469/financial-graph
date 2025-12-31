// Edit History and Undo Operations

import { db, tx } from "../client";
import type { EditHistoryEntry } from "../../types";

export const useEditHistory = (limit = 50) => {
  const { data, isLoading, error } = db.useQuery({ editHistory: {} });
  const history = [...((data?.editHistory ?? []) as EditHistoryEntry[])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
  return { history, isLoading, error };
};

export const clearHistory = (entryIds: string[]) => {
  const ops = entryIds.map((id) => tx.editHistory[id].delete());
  return db.transact(ops);
};

export const undoEdit = async (entry: EditHistoryEntry) => {
  let undoOps: any[] = [];

  switch (entry.action) {
    case "create_event":
      undoOps = [tx.events[entry.targetId].delete()];
      break;
    case "update_event":
      if (entry.previousData) undoOps = [tx.events[entry.targetId].update(entry.previousData)];
      break;
    case "delete_event":
      if (entry.previousData) undoOps = [tx.events[entry.targetId].update(entry.previousData)];
      break;
    case "create_node":
      undoOps = [tx.nodes[entry.targetId].delete()];
      break;
    case "delete_node":
      if (entry.previousData) undoOps = [tx.nodes[entry.targetId].update(entry.previousData)];
      break;
    case "update_node":
      if (entry.previousData) undoOps = [tx.nodes[entry.targetId].update(entry.previousData)];
      break;
    case "create_edge":
      undoOps = [tx.edges[entry.targetId].delete()];
      break;
    case "delete_edge":
      if (entry.previousData) undoOps = [tx.edges[entry.targetId].update(entry.previousData)];
      break;
    case "bulk_import":
      if (entry.newData) {
        const { eventIds = [], entityIds = [], edgeIds = [] } = entry.newData as any;
        undoOps = [
          ...eventIds.map((id: string) => tx.events[id].delete()),
          ...entityIds.map((id: string) => tx.nodes[id].delete()),
          ...edgeIds.map((id: string) => tx.edges[id].delete()),
        ];
      }
      break;
  }

  // Perform undo and delete the history entry
  if (undoOps.length > 0) {
    return db.transact([...undoOps, tx.editHistory[entry.id].delete()]);
  }
};
