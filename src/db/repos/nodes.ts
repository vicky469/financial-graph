// Node Domain Operations

import { db, tx, recordEdit, getCurrentUser } from "../client";
import type { Node } from "../../types";
import { generateNodeId } from "../../utils/idGenerator";

export const createNode = (node: Omit<Node, "id" | "createdAt" | "createdBy">) => {
  const nodeId = generateNodeId(node.name);
  const currentUser = getCurrentUser();
  const data = {
    ...node,
    createdAt: Date.now(),
    createdBy: currentUser.userName,
  };
  return db.transact([
    tx.nodes[nodeId].update(data),
    recordEdit("create_node", nodeId, "node", undefined, data),
  ]);
};

export const updateNode = (
  nodeId: string,
  prev: Partial<Node>,
  updates: Partial<Omit<Node, "id" | "createdAt" | "createdBy">>
) =>
  db.transact([
    tx.nodes[nodeId].update(updates),
    recordEdit("update_node", nodeId, "node", prev, updates),
  ]);

export const deleteNode = (nodeId: string, prev: Node) =>
  db.transact([
    tx.nodes[nodeId].delete(),
    recordEdit("delete_node", nodeId, "node", { ...prev }, undefined),
  ]);
