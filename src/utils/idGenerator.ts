// Deterministic ID Generation Utilities

/**
 * Simple hash function to create a deterministic number from a string
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Convert a hash to a UUID v4 format string (deterministic)
 */
const hashToUUID = (hash1: number, hash2: number): string => {
  const hex1 = hash1.toString(16).padStart(8, "0");
  const hex2 = hash2.toString(16).padStart(8, "0");

  // Create UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return `${hex1.slice(0, 8)}-${hex1.slice(8, 12) || "0000"}-4${hex2.slice(0, 3)}-${(
    (parseInt(hex2[3] || "0", 16) & 0x3) |
    0x8
  ).toString(16)}${hex2.slice(4, 7)}-${hex2.slice(7, 19).padEnd(12, "0")}`;
};

/**
 * Generate a deterministic UUID for an event based on title and date
 * Same title + date = same UUID = update instead of duplicate
 */
export const generateEventId = (title: string, date: string): string => {
  const compositeKey = `${title.trim().toLowerCase()}||${date}`;
  const hash1 = hashString(compositeKey);
  const hash2 = hashString(compositeKey + "event");
  return hashToUUID(hash1, hash2);
};

/**
 * Generate a deterministic UUID for a node based on name
 * Same name = same UUID = update instead of duplicate
 */
export const generateNodeId = (name: string): string => {
  const compositeKey = name.trim().toLowerCase();
  const hash1 = hashString(compositeKey);
  const hash2 = hashString(compositeKey + "node");
  return hashToUUID(hash1, hash2);
};

/**
 * Generate a deterministic UUID for an edge based on source and target
 * Same source + target = same UUID = update instead of duplicate
 */
export const generateEdgeId = (sourceId: string, targetId: string): string => {
  const compositeKey = `${sourceId}||${targetId}`;
  const hash1 = hashString(compositeKey);
  const hash2 = hashString(compositeKey + "edge");
  return hashToUUID(hash1, hash2);
};
