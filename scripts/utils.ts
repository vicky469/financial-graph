import { createHash } from "crypto";
import { init } from "@instantdb/admin";
import "dotenv/config";

/**
 * Initialize InstantDB connection for scripts
 */
export function getDb() {
  const APP_ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

  if (!APP_ADMIN_TOKEN) {
    console.error("❌ Missing INSTANTDB_ADMIN_TOKEN in .env file");
    process.exit(1);
  }

  if (!process.env.VITE_INSTANTDB_APP_ID) {
    console.error("❌ Missing VITE_INSTANTDB_APP_ID in .env file");
    process.exit(1);
  }

  return init({
    appId: process.env.VITE_INSTANTDB_APP_ID,
    adminToken: APP_ADMIN_TOKEN,
  });
}

/**
 * Generate deterministic UUID from a string (namespace + name)
 * Same input always produces same ID
 */
export function deterministicId(namespace: string, name: string): string {
  const hash = createHash("sha256").update(`${namespace}:${name}`).digest("hex");

  // Format as valid UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Version 4: third group starts with '4'
  // Variant: fourth group starts with '8', '9', 'a', or 'b'
  const variant = hash.substring(16, 17);
  const variantChar = ["8", "9", "a", "b"][parseInt(variant, 16) % 4];

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "4" + hash.substring(13, 16), // Version 4
    variantChar + hash.substring(17, 20), // Variant bits
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Generate IDs for common entity types
 */
export const generateId = {
  node: (name: string) => deterministicId("node", name.toLowerCase().trim()),
  event: (title: string, date: string) =>
    deterministicId("event", `${title.toLowerCase().trim()}-${date}`),
  edge: (sourceId: string, targetId: string) => deterministicId("edge", `${sourceId}-${targetId}`),
};
