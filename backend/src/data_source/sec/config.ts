import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

function parseYears(value: string): number[] {
  return value
    .split(",")
    .map((year) => year.trim())
    .filter((year) => year.length > 0)
    .map((year) => Number(year))
    .filter((year) => !Number.isNaN(year));
}

export const SEC_YEARS = parseYears(process.env.SEC_YEARS ?? "2015");
export const SEC_QUARTERS = [1, 2, 3, 4] as const;

export const SEC_RAW_DIR = path.resolve(__dirname, "raw");
export const SEC_OUTPUT_DIR = path.resolve(__dirname, "output");

export const SEC_REQUEST_DELAY_MS = Number(
  process.env.SEC_REQUEST_DELAY_MS ?? 500
);
export const SEC_REQUEST_MAX_RETRIES = Number(
  process.env.SEC_REQUEST_MAX_RETRIES ?? 3
);

export const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ??
  (() => {
    throw new Error("Missing SEC_USER_AGENT env variable");
  })();
