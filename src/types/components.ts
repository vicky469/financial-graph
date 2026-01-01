// Component prop types and UI-specific interfaces

import type { Node } from "./domain";

export interface NodeData extends Node {
  isSelected: boolean;
  isSubsidiary?: boolean;
  isPublic?: boolean;
  otherUserSelecting?: {
    userName: string;
    color: string;
  } | null;
}

// App state machine context
export interface AppContext {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  focusedNodeId: string | null;
  viewingNodeId: string | null;
  userId: string;
  userName: string;
  userColor: string;
}

// App state machine events
export type AppEvent =
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "SELECT_EDGE"; edgeId: string | null }
  | { type: "FOCUS_NODE"; nodeId: string }
  | { type: "CLEAR_FOCUS" }
  | { type: "VIEW_NODE"; nodeId: string }
  | { type: "CLEAR_VIEW" }
  | { type: "SET_USER"; userId: string; userName: string; userColor: string };

// FinancialGraph component props
export interface FinancialGraphProps {
  context: AppContext;
  onSelectEdge?: (edgeId: string | null) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onFocusNode: (nodeId: string) => void;
  onViewNode: (nodeId: string) => void;
  onClearFocus: () => void;
  showNodes?: boolean;
  showBrands?: boolean;
}

// Sidebar component props
export interface SidebarProps {
  context: AppContext;
  onFocusNode: (nodeId: string) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  showNodes: boolean;
  onToggleNodes: () => void;
  showBrands: boolean;
  onToggleBrands: () => void;
}
