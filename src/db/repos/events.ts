// Event Domain Operations

import { db, tx, recordEdit, getCurrentUser } from "../client";
import type { Event } from "../../types";
import { generateEventId } from "../../utils/idGenerator";

export const createEvent = (event: Omit<Event, "id" | "createdAt" | "createdBy">) => {
  const eventId = generateEventId(event.title, event.date);
  const currentUser = getCurrentUser();
  const data = {
    ...event,
    createdAt: Date.now(),
    createdBy: currentUser.userName,
  };
  return db.transact([
    tx.events[eventId].update(data),
    recordEdit("create_event", eventId, "event", undefined, data),
  ]);
};

export const updateEvent = (
  eventId: string,
  prev: Partial<Event>,
  updates: Partial<Omit<Event, "id" | "createdAt" | "createdBy">>
) =>
  db.transact([
    tx.events[eventId].update(updates),
    recordEdit("update_event", eventId, "event", prev, updates),
  ]);

export const deleteEvent = (eventId: string, prev: Event) =>
  db.transact([
    tx.events[eventId].delete(),
    recordEdit("delete_event", eventId, "event", { ...prev }, undefined),
  ]);
