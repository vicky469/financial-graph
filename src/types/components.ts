// Component prop types and UI-specific interfaces

import type { Event, Entity } from "./domain";

// React Flow node data for EventNode component
export interface EventNodeData extends Event {
  isSelected: boolean;
  isEditing: boolean;
  otherUserSelecting?: {
    userName: string;
    color: string;
  } | null;
}

export interface EntityNodeData extends Entity {
  isSelected: boolean;
  isEditing: boolean;
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
  isEditing: boolean;
  editingEventId: string | null;
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
  | { type: "CLEAR_FOCUS" }
  | { type: "START_EDIT"; eventId: string }
  | { type: "END_EDIT" }
  | { type: "SET_USER"; userId: string; userName: string; userColor: string };

// FailureGraph component props
export interface FailureGraphProps {
  context: AppContext;
  onSelectEvent: (eventId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  onSelectEntity?: (entityId: string | null) => void;
  onFocusTrigger: (triggerId: string) => void;
  onClearFocus: () => void;
  showActors?: boolean;
}

// Sidebar component props
export interface SidebarProps {
  context: AppContext;
  onFocusTrigger: (triggerId: string) => void;
  onSelectEntity?: (entityId: string) => void;
  showActors: boolean;
  onToggleActors: () => void;
}
