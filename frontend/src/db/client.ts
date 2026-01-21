// InstantDB Client Initialization and Shared Utilities

import { init, tx, id } from "@instantdb/react";
import { schema } from "financial-graph-shared";

const APP_ID = import.meta.env.VITE_INSTANTDB_APP_ID;

// Initialize with schema - Google OAuth is handled separately
export const db = init({ 
  appId: APP_ID,
  schema,
});

// Google OAuth configuration
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_NAME = import.meta.env.VITE_GOOGLE_CLIENT_NAME;

// Current user context (set from state machine)
let currentUser = { userId: "", userName: "" };

export const setCurrentUser = (userId: string, userName: string) => {
  currentUser = { userId, userName };
};

export const getCurrentUser = () => currentUser;

export { tx, id };
