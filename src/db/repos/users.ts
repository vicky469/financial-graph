// User Selection Operations

import { db, tx, id } from "../client";

// Store user's DB ID (generated once per session)
let userDbId: string | null = null;

export const updateUserSelection = (
  odxerId: string,
  userName: string,
  selectedEventId: string | null,
  color: string
) => {
  // Generate a UUID for this user session if we don't have one
  if (!userDbId) {
    userDbId = id();
  }

  return db.transact(
    tx.userSelections[userDbId].update({
      odxerId,
      userName,
      selectedEventId: selectedEventId ?? undefined,
      color,
      lastUpdated: Date.now(),
    })
  );
};
