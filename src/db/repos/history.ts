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
  switch (entry.action) {
    case "create_event":
      return db.transact(tx.events[entry.targetId].delete());
    case "delete_event":
      if (entry.previousData)
        return db.transact(tx.events[entry.targetId].update(entry.previousData));
      break;
    case "create_entity":
      return db.transact(tx.entities[entry.targetId].delete());
    case "delete_entity":
      if (entry.previousData)
        return db.transact(tx.entities[entry.targetId].update(entry.previousData));
      break;
    case "update_entity":
      if (entry.previousData)
        return db.transact(tx.entities[entry.targetId].update(entry.previousData));
      break;
    case "create_edge":
      return db.transact(tx.edges[entry.targetId].delete());
    case "delete_edge":
      if (entry.previousData)
        return db.transact(tx.edges[entry.targetId].update(entry.previousData));
      break;
    case "bulk_import":
      if (entry.newData) {
        const { eventIds = [], entityIds = [], edgeIds = [] } = entry.newData as any;
        return db.transact([
          ...eventIds.map((id: string) => tx.events[id].delete()),
          ...entityIds.map((id: string) => tx.entities[id].delete()),
          ...edgeIds.map((id: string) => tx.edges[id].delete()),
        ]);
      }
      break;
  }
};
