// XState App State Machine
// Manages UI state: selection, filtering, editing modes

import { createMachine, assign } from "xstate";
import type { AppContext } from "../types";

const STORAGE_KEY = "financial-graph-user";

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
    selectedNodeId: null,
    selectedEdgeId: null,
    focusedTriggerId: null,
    focusedNodeId: null,
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
            selectedNodeId: null,
            selectedEdgeId: null, // Clear edge selection
          }),
        },
        SELECT_NODE: {
          actions: assign({
            selectedNodeId: ({ event }) => event.nodeId,
            selectedEventId: null,
            selectedEdgeId: null,
          }),
        },
        SELECT_EDGE: {
          actions: assign({
            selectedEdgeId: ({ event }) => event.edgeId,
            selectedEventId: null, // Clear event selection
            selectedNodeId: null,
          }),
        },
        FOCUS_TRIGGER: {
          target: "filtering",
          actions: assign({
            focusedTriggerId: ({ event }) => event.triggerId,
            focusedNodeId: null,
            selectedEventId: ({ event }) => event.triggerId,
            selectedNodeId: null,
            selectedEdgeId: null,
          }),
        },
        FOCUS_NODE: {
          target: "filtering",
          actions: assign({
            focusedNodeId: ({ event }) => event.nodeId,
            focusedTriggerId: null,
            selectedNodeId: null,
            selectedEventId: null,
            selectedEdgeId: null,
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
            focusedNodeId: null,
            selectedEventId: null,
            selectedNodeId: null,
            selectedEdgeId: null,
          }),
        },
        FOCUS_TRIGGER: {
          actions: assign({
            focusedTriggerId: ({ event }) => event.triggerId,
            focusedNodeId: null,
            selectedEventId: ({ event }) => event.triggerId,
            selectedNodeId: null,
          }),
        },
        FOCUS_NODE: {
          actions: assign({
            focusedNodeId: ({ event }) => event.nodeId,
            focusedTriggerId: null,
            selectedNodeId: null,
            selectedEventId: null,
          }),
        },
        SELECT_EVENT: {
          actions: assign({
            selectedEventId: ({ event }) => event.eventId,
            selectedNodeId: null,
            selectedEdgeId: null,
          }),
        },
        SELECT_NODE: {
          actions: assign({
            selectedNodeId: ({ event }) => event.nodeId,
            selectedEventId: null,
            selectedEdgeId: null,
          }),
        },
        SELECT_EDGE: {
          actions: assign({
            selectedEdgeId: ({ event }) => event.edgeId,
            selectedEventId: null,
            selectedNodeId: null,
          }),
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
