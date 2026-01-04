// Collaboration & audit trail types

export interface UserSelection {
  id: string;
  odxerId: string; // User identifier from the client state machine
  userName: string;
  selectedNodeId?: string;
  color: string;
  lastUpdated: number;
}

export type EditAction =
  | "create_node"
  | "update_node"
  | "delete_node"
  | "create_edge"
  | "update_edge"
  | "delete_edge"
  | "bulk_import";

export interface EditHistoryEntry {
  id: string;
  action: EditAction;
  targetId: string;
  targetType: "edge" | "node" | "bulk";
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  userId: string;
  userName: string;
  timestamp: number;
}
