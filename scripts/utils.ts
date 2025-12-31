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

import { generateNodeId, generateEventId, generateEdgeId } from "../src/utils/idGenerator";

/**
 * Generate IDs for common entity types
 */
export const generateId = {
  node: generateNodeId,
  event: generateEventId,
  edge: generateEdgeId,
};
