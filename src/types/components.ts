// Component prop types and UI-specific interfaces

import type { Event, Edge, Node, EditHistoryEntry, UserSelection } from "./domain";

// React Flow node data for EventNode component
export interface EventNodeData extends Event {
  isSelected: boolean;
  otherUserSelecting?: {
    userName: string;
    color: string;
  } | null;
}

export interface NodeData extends Node {
  isSelected: boolean;
  otherUserSelecting?: {
    userName: string;
    color: string;
  } | null;
}

// App state machine context
export interface AppContext {
  selectedEventId: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  focusedTriggerId: string | null;
  focusedNodeId: string | null;
  userId: string;
  userName: string;
  userColor: string;
}

// App state machine events
export type AppEvent =
  | { type: "SELECT_EVENT"; eventId: string | null }
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "SELECT_EDGE"; edgeId: string | null }
  | { type: "FOCUS_TRIGGER"; triggerId: string }
  | { type: "FOCUS_NODE"; nodeId: string }
  | { type: "CLEAR_FOCUS" }
  | { type: "SET_USER"; userId: string; userName: string; userColor: string };

// FinancialGraph component props
export interface FinancialGraphProps {
  context: AppContext;
  onSelectEvent: (eventId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onFocusTrigger: (triggerId: string) => void;
  onFocusNode: (nodeId: string) => void;
  onClearFocus: () => void;
  showNodes?: boolean;
  showTriggersOnGraph?: boolean;
  showNonTriggersOnGraph?: boolean;
}

// Sidebar component props
export interface SidebarProps {
  context: AppContext;
  onFocusTrigger: (triggerId: string) => void;
  onFocusNode: (nodeId: string) => void;
  onSelectEvent: (eventId: string | null) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  showNodes: boolean;
  onToggleNodes: () => void;
  showTriggersOnGraph: boolean;
  setShowTriggersOnGraph: (show: boolean) => void;
  showNonTriggersOnGraph: boolean;
  setShowNonTriggersOnGraph: (show: boolean) => void;
}
