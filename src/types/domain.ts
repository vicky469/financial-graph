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

export interface Entity {
  id: string;
  name: string;
  type: string; // e.g., "Bank", "Sector", "Regulator"
  properties: Record<string, string>; // e.g., { "assets": "$200B", "risk": "High" }
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
  selectedEntityId?: string;
  color: string;
  lastUpdated: number;
}

export type EditAction =
  | "create_event"
  | "update_event"
  | "delete_event"
  | "create_entity"
  | "update_entity"
  | "delete_entity"
  | "create_edge"
  | "update_edge"
  | "delete_edge"
  | "bulk_import";

export interface EditHistoryEntry {
  id: string;
  action: EditAction;
  targetId: string;
  targetType: "event" | "edge" | "entity" | "bulk";
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  userId: string;
  userName: string;
  timestamp: number;
}
