// Domain types for Financial Graph
// These represent the core business entities

export interface Event {
  id: string;
  title: string;
  description: string;
  link?: string; // URL for verification/source
  isTrigger: boolean;
  date: string; // YYYY-MM-DD format
  createdAt: number;
  createdBy: string;
}

export const NodeType = {
  Company: "Company",
  Brand: "Brand",
  DataSource: "DataSource",
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export interface BaseNode {
  id: string;
  name: string;
  validFrom?: number;

  validTo?: number;
  url?: string;
}

export interface Node extends BaseNode {
  type: NodeType | string; // allowing string for legacy/seed compatibility temporarily
  properties: Record<string, string>; // e.g., { "assets": "$200B", "risk": "High" }
  jurisdiction?: string;
  cik?: string;
  createdAt: number;
  createdBy: string;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  edgeType?: "causal" | "simultaneous"; // Visual style: causal (solid) or simultaneous (dashed)
  createdAt: number;
  createdBy: string;
}

export interface UserSelection {
  id: string;
  odxerId: string; // User identifier
  userName: string;
  selectedEventId?: string;
  selectedNodeId?: string;
  color: string;
  lastUpdated: number;
}

export type EditAction =
  | "create_event"
  | "update_event"
  | "delete_event"
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
  targetType: "event" | "edge" | "node" | "bulk";
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  userId: string;
  userName: string;
  timestamp: number;
}
