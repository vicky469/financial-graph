// InstantDB Client Initialization and Shared Utilities

import { init, tx, id } from "@instantdb/react";

const APP_ID = import.meta.env.VITE_INSTANTDB_APP_ID;

// Note: We don't pass a schema here because the frontend uses @instantdb/react
// which has a different schema API than the backend's @instantdb/core.
// The backend schema is in @financial-graph/shared and used by ingestion scripts.
// For querying, we don't need to pass a schema.
export const db = init({ appId: APP_ID });

// Current user context (set from state machine)
let currentUser = { userId: "", userName: "" };

export const setCurrentUser = (userId: string, userName: string) => {
  currentUser = { userId, userName };
};

export const getCurrentUser = () => currentUser;

export { tx, id };
