// Component prop types and UI-specific interfaces

import type { Event, Entity } from "./domain";

// React Flow node data for EventNode component
export interface EventNodeData extends Event {
  isSelected: boolean;
  otherUserSelecting?: {
    userName: string;
    color: string;
  } | null;
}

export interface EntityNodeData extends Entity {
  isSelected: boolean;
  otherUserSelecting?: {
    userName: string;
    color: string;
  } | null;
}

// App state machine context
export interface AppContext {
  selectedEventId: string | null;
  selectedEntityId: string | null;
  selectedEdgeId: string | null;
  focusedTriggerId: string | null;
  focusedEntityId: string | null;
  userId: string;
  userName: string;
  userColor: string;
}

// App state machine events
export type AppEvent =
  | { type: "SELECT_EVENT"; eventId: string | null }
  | { type: "SELECT_ENTITY"; entityId: string | null }
  | { type: "SELECT_EDGE"; edgeId: string | null }
  | { type: "FOCUS_TRIGGER"; triggerId: string }
  | { type: "FOCUS_ENTITY"; entityId: string }
  | { type: "CLEAR_FOCUS" }
  | { type: "SET_USER"; userId: string; userName: string; userColor: string };

// FinancialGraph component props
export interface FinancialGraphProps {
  context: AppContext;
  onSelectEvent: (eventId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  onSelectEntity?: (entityId: string | null) => void;
  onFocusTrigger: (triggerId: string) => void;
  onFocusEntity: (entityId: string) => void;
  onClearFocus: () => void;
  showEntities?: boolean;
  showTriggersOnGraph?: boolean;
  showNonTriggersOnGraph?: boolean;
}

// Sidebar component props
export interface SidebarProps {
  context: AppContext;
  onFocusTrigger: (triggerId: string) => void;
  onFocusEntity: (entityId: string) => void;
  onSelectEvent?: (eventId: string | null) => void;
  onSelectEntity?: (entityId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  showEntities: boolean;
  onToggleEntities: () => void;
  showTriggersOnGraph: boolean;
  setShowTriggersOnGraph: (show: boolean) => void;
  showNonTriggersOnGraph: boolean;
  setShowNonTriggersOnGraph: (show: boolean) => void;
}
