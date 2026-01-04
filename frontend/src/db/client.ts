// InstantDB Client Initialization and Shared Utilities

import { init, tx, id } from "@instantdb/react";
import schema from "./schema";
import type { EditHistoryEntry } from "../types";

const APP_ID = import.meta.env.VITE_INSTANTDB_APP_ID;

export const db = init({ appId: APP_ID, schema });

// Current user context (set from state machine)
let currentUser = { userId: "", userName: "" };

export const setCurrentUser = (userId: string, userName: string) => {
  currentUser = { userId, userName };
};

export const getCurrentUser = () => currentUser;

// Shared helper for recording edits
export const recordEdit = (
  action: EditHistoryEntry["action"],
  targetId: string,
  targetType: EditHistoryEntry["targetType"],
  previousData?: Record<string, unknown>,
  newData?: Record<string, unknown>
) =>
  tx.editHistory[id()].update({
    action,
    targetId,
    targetType,
    previousData,
    newData,
    userId: currentUser.userId,
    userName: currentUser.userName,
    timestamp: Date.now(),
  });

export { tx, id };
