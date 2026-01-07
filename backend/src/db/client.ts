import { init } from "@instantdb/admin";
import dotenv from "dotenv";
import path from "path";
import schema from "./schema";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const APP_ID = process.env.INSTANT_APP_ID;
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_SECRET;

if (!APP_ID || !ADMIN_TOKEN) {
  throw new Error("Missing INSTANT_APP_ID or INSTANT_ADMIN_SECRET in .env");
}

// Initialize InstantDB with schema for type safety and index definitions
export const db = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN,
  schema,
});

export type DB = typeof db;
