// Collaboration types

export interface UserSelection {
  id: string;
  odxerId: string; // User identifier from the client state machine
  userName: string;
  selectedNodeId?: string;
  color: string;
  lastUpdated: number;
}

