import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const OUTPUT_ROOT = path.resolve(__dirname, "..", "output");
export const INDEX_DIR = path.join(OUTPUT_ROOT, "index");
export const DATA_DIR = path.join(OUTPUT_ROOT, "data");

export const SEC_QUARTERS = [1, 2, 3, 4] as const;
export const SEC_REQUEST_DELAY_MS = 500;
export const SEC_REQUEST_MAX_RETRIES = 3;
export const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ??
  (() => {
    throw new Error("Missing SEC_USER_AGENT env variable");
  })();
