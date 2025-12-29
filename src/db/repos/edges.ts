// Edge Domain Operations

import { db, tx, recordEdit, getCurrentUser } from "../client";
import type { Edge } from "../../types";
import { generateEdgeId } from "../../utils/idGenerator";

export const createEdge = (
  sourceId: string,
  targetId: string,
  label = "led to",
  edgeType: "causal" | "simultaneous" = "causal"
) => {
  const edgeId = generateEdgeId(sourceId, targetId);
  const currentUser = getCurrentUser();
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
    recordEdit("update_edge", edgeId, "edge", { ...prev }, updates),
  ]);
