// XState App State Machine
// Manages UI state: selection, filtering, editing modes

import { createMachine, assign } from "xstate";
import type { AppContext } from "../types";

const STORAGE_KEY = "failure-tracker-user";

// Get or create persistent user identity
const getOrCreateUser = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid JSON, create new user
    }
  }

  // Generate new user
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"];
  const adjectives = ["Swift", "Clever", "Bold", "Calm", "Wise"];
  const nouns = ["Bunny", "Goose", "Owl", "Wolf", "Bear"];

  const user = {
    userId: `user_${Math.random().toString(36).substr(2, 9)}`,
    userName: `${adjectives[Math.floor(Math.random() * 5)]} ${
      nouns[Math.floor(Math.random() * 5)]
    }`,
    userColor: colors[Math.floor(Math.random() * 6)],
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
};

const persistentUser = getOrCreateUser();

export const appMachine = createMachine({
  id: "app",
  initial: "idle",
  context: {
    selectedEventId: null,
    selectedEntityId: null, // New: Selection for entities
    selectedEdgeId: null,
    focusedTriggerId: null,
    isEditing: false,
    editingEventId: null,
    userId: persistentUser.userId,
    userName: persistentUser.userName,
    userColor: persistentUser.userColor,
  } as AppContext,
  states: {
    idle: {
      on: {
        SELECT_EVENT: {
          actions: assign({
            selectedEventId: ({ event }) => event.eventId,
            selectedEntityId: null,
            selectedEdgeId: null, // Clear edge selection
          }),
        },
        SELECT_ENTITY: {
          actions: assign({
            selectedEntityId: ({ event }) => event.entityId,
            selectedEventId: null,
            selectedEdgeId: null,
          }),
        },
        SELECT_EDGE: {
          actions: assign({
            selectedEdgeId: ({ event }) => event.edgeId,
            selectedEventId: null, // Clear event selection
            selectedEntityId: null,
          }),
        },
        FOCUS_TRIGGER: {
          target: "filtering",
          actions: assign({
            focusedTriggerId: ({ event }) => event.triggerId,
            selectedEventId: ({ event }) => event.triggerId,
            selectedEntityId: null,
            selectedEdgeId: null,
          }),
        },
        START_EDIT: {
          target: "editing",
          actions: assign({
            editingEventId: ({ event }) => event.eventId,
            isEditing: true,
          }),
        },
      },
    },
    filtering: {
      on: {
        CLEAR_FOCUS: {
          target: "idle",
          actions: assign({
            focusedTriggerId: null,
            selectedEventId: null,
            selectedEntityId: null,
            selectedEdgeId: null,
          }),
        },
        FOCUS_TRIGGER: {
          actions: assign({
            focusedTriggerId: ({ event }) => event.triggerId,
            selectedEventId: ({ event }) => event.triggerId,
            selectedEntityId: null, // Clear entity selection if focusing trigger
          }),
        },
        SELECT_EVENT: {
          actions: assign({
            selectedEventId: ({ event }) => event.eventId,
            selectedEntityId: null,
            selectedEdgeId: null,
          }),
        },
        SELECT_ENTITY: {
          actions: assign({
            selectedEntityId: ({ event }) => event.entityId,
            selectedEventId: null,
            selectedEdgeId: null,
          }),
        },
        SELECT_EDGE: {
          actions: assign({
            selectedEdgeId: ({ event }) => event.edgeId,
            selectedEventId: null,
            selectedEntityId: null,
          }),
        },
        START_EDIT: {
          target: "editing",
          actions: assign({
            editingEventId: ({ event }) => event.eventId,
            isEditing: true,
          }),
        },
      },
    },
    editing: {
      on: {
        END_EDIT: {
          target: "idle",
          actions: assign({ editingEventId: null, isEditing: false }),
        },
      },
    },
  },
  on: {
    SET_USER: {
      actions: assign({
        userId: ({ event }) => event.userId,
        userName: ({ event }) => event.userName,
        userColor: ({ event }) => event.userColor,
      }),
    },
  },
});
