// InstantDB Client and Operations
// All database interactions go through this file

import { init, tx, id } from "@instantdb/react";
import schema from "./schema";
import type { Event, Edge, Entity, EditHistoryEntry } from "./types";

const APP_ID = import.meta.env.VITE_INSTANTDB_APP_ID;

export const db = init({ appId: APP_ID, schema });

// Current user context (set from state machine)
let currentUser = { userId: "", userName: "" };

export const setCurrentUser = (userId: string, userName: string) => {
  currentUser = { userId, userName };
};

// === Private Helpers ===

export const recordEdit = (
  action: EditHistoryEntry["action"],
  targetId: string,
  targetType: EditHistoryEntry["targetType"],
  previousData?: Record<string, unknown>,
  newData?: Record<string, unknown>
) =>
  tx.editHistory[id()].update({
    action,
    targetId,
    targetType,
    previousData,
    newData,
    userId: currentUser.userId,
    userName: currentUser.userName,
    timestamp: Date.now(),
  });

// === Event Operations ===

export const createEvent = (
  event: Omit<Event, "id" | "createdAt" | "createdBy">
) => {
  const eventId = id();
  const data = {
    ...event,
    createdAt: Date.now(),
    createdBy: currentUser.userName,
  };
  return db.transact([
    tx.events[eventId].update(data),
    recordEdit("create_event", eventId, "event", undefined, data),
  ]);
};

export const updateEvent = (
  eventId: string,
  prev: Partial<Event>,
  updates: Partial<Omit<Event, "id" | "createdAt" | "createdBy">>
) =>
  db.transact([
    tx.events[eventId].update(updates),
    recordEdit("update_event", eventId, "event", prev, updates),
  ]);

export const deleteEvent = (eventId: string, prev: Event) =>
  db.transact([
    tx.events[eventId].delete(),
    recordEdit("delete_event", eventId, "event", { ...prev }, undefined),
  ]);

// === Entity Operations ===

export const createEntity = (
  entity: Omit<Entity, "id" | "createdAt" | "createdBy">
) => {
  const entityId = id();
  const data = {
    ...entity,
    createdAt: Date.now(),
    createdBy: currentUser.userName,
  };
  return db.transact([
    tx.entities[entityId].update(data),
    recordEdit("create_entity", entityId, "entity", undefined, data),
  ]);
};

export const updateEntity = (
  entityId: string,
  prev: Partial<Entity>,
  updates: Partial<Omit<Entity, "id" | "createdAt" | "createdBy">>
) =>
  db.transact([
    tx.entities[entityId].update(updates),
    recordEdit("update_entity", entityId, "entity", prev, updates),
  ]);

export const deleteEntity = (entityId: string, prev: Entity) =>
  db.transact([
    tx.entities[entityId].delete(),
    recordEdit("delete_entity", entityId, "entity", { ...prev }, undefined),
  ]);

// === Edge Operations ===

export const createEdge = (
  sourceId: string,
  targetId: string,
  label = "led to",
  edgeType: "causal" | "simultaneous" = "causal"
) => {
  const edgeId = id();
  const data = {
    sourceId,
    targetId,
    label,
    edgeType,
    createdAt: Date.now(),
    createdBy: currentUser.userName,
  };
  return db.transact([
    tx.edges[edgeId].update(data),
    recordEdit("create_edge", edgeId, "edge", undefined, data),
  ]);
};

export const deleteEdge = (edgeId: string, prev: Edge) =>
  db.transact([
    tx.edges[edgeId].delete(),
    recordEdit("delete_edge", edgeId, "edge", { ...prev }, undefined),
  ]);

export const updateEdge = (
  edgeId: string,
  prev: Edge,
  updates: Partial<Omit<Edge, "id" | "createdAt" | "createdBy">>
) =>
  db.transact([
    tx.edges[edgeId].update(updates),
    recordEdit("create_edge", edgeId, "edge", { ...prev }, updates),
  ]);

// === User Selection ===

// Store user's DB ID (generated once per session)
let userDbId: string | null = null;

export const updateUserSelection = (
  odxerId: string,
  userName: string,
  selectedEventId: string | null,
  color: string
) => {
  // Generate a UUID for this user session if we don't have one
  if (!userDbId) {
    userDbId = id();
  }

  return db.transact(
    tx.userSelections[userDbId].update({
      odxerId,
      userName,
      selectedEventId: selectedEventId ?? undefined,
      color,
      lastUpdated: Date.now(),
    })
  );
};

// === Query Hooks ===

export const useGraph = () => {
  const { data, isLoading, error } = db.useQuery({
    events: {},
    entities: {},
    edges: {},
    userSelections: {},
  });
  return {
    events: (data?.events ?? []) as Event[],
    entities: (data?.entities ?? []) as Entity[],
    edges: (data?.edges ?? []) as Edge[],
    selections: data?.userSelections ?? [],
    isLoading,
    error,
  };
};

export const useEditHistory = (limit = 50) => {
  const { data, isLoading, error } = db.useQuery({ editHistory: {} });
  const history = [...((data?.editHistory ?? []) as EditHistoryEntry[])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
  return { history, isLoading, error };
};

export const clearHistory = (entryIds: string[]) => {
  // Batch deletes in chunks of 50 to be safe (though transact handles many)
  // InstantDB transact takes array.
  const ops = entryIds.map((id) => tx.editHistory[id].delete());
  return db.transact(ops);
};

// === Undo ===

export const undoEdit = async (entry: EditHistoryEntry) => {
  switch (entry.action) {
    case "create_event":
      return db.transact(tx.events[entry.targetId].delete());
    case "delete_event":
      if (entry.previousData)
        return db.transact(
          tx.events[entry.targetId].update(entry.previousData)
        );
      break;
    case "create_entity":
      return db.transact(tx.entities[entry.targetId].delete());
    case "delete_entity":
      if (entry.previousData)
        return db.transact(
          tx.entities[entry.targetId].update(entry.previousData)
        );
      break;
    case "update_entity":
      if (entry.previousData)
        return db.transact(
          tx.entities[entry.targetId].update(entry.previousData)
        );
      break;
    case "create_edge":
      return db.transact(tx.edges[entry.targetId].delete());
    case "delete_edge":
      if (entry.previousData)
        return db.transact(tx.edges[entry.targetId].update(entry.previousData));
      break;
    case "bulk_import":
      if (entry.newData) {
        const {
          eventIds = [],
          entityIds = [],
          edgeIds = [],
        } = entry.newData as any;
        return db.transact([
          ...eventIds.map((id: string) => tx.events[id].delete()),
          ...entityIds.map((id: string) => tx.entities[id].delete()),
          ...edgeIds.map((id: string) => tx.edges[id].delete()),
          tx.editHistory[entry.id].delete(), // Remove history entry itself? standard undo logic usually assumes history is kept or handled?
          // Actually undoEdit doesn't delete history entry usually.
          // But usually we reverse the action.
        ]);
      }
      break;
  }
};

export { tx, id };
