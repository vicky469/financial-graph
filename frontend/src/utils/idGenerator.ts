// Deterministic ID Generation Utilities
import { v5 as uuidv5 } from "uuid";

// Namespace for Financial Graph application (generated v4 UUID)
// Keeping this constant ensures IDs are deterministic across imports/runs
const APP_NAMESPACE = "e9b5f586-2319-487a-85ba-667746187588";

/**
 * Generate a deterministic UUID for an event based on title and date
 * Same title + date = same UUID = update instead of duplicate
 */
export const generateEventId = (title: string, date: string): string => {
  const compositeKey = `${title.trim().toLowerCase()}||${date}`;
  return uuidv5(compositeKey, APP_NAMESPACE);
};

/**
 * Generate a deterministic UUID for a node based on name
 * Same name = same UUID = update instead of duplicate
 */
export const generateNodeId = (name: string): string => {
  const compositeKey = name.trim().toLowerCase();
  return uuidv5(compositeKey, APP_NAMESPACE);
};

/**
 * Generate a deterministic UUID for an edge based on source and target
 * Same source + target = same UUID = update instead of duplicate
 */
export const generateEdgeId = (sourceId: string, targetId: string): string => {
  const compositeKey = `${sourceId}||${targetId}`;
  return uuidv5(compositeKey, APP_NAMESPACE);
};
