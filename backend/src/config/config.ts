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

const OUTPUT_ROOT = path.resolve(__dirname, "..", "output");

export const INDEX_DIR = path.join(OUTPUT_ROOT, "index");
export const DATA_DIR = path.join(OUTPUT_ROOT, "data");

export const SEC_REQUEST_DELAY_MS = Number(
  process.env.SEC_REQUEST_DELAY_MS ?? 500,
);
export const SEC_REQUEST_MAX_RETRIES = Number(
  process.env.SEC_REQUEST_MAX_RETRIES ?? 3,
);

export const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ??
  (() => {
    throw new Error("Missing SEC_USER_AGENT env variable");
  })();

// Ingestion tuning presets (keep centralized so jobs share best-practice limits)
export type IngestionProfileKey = "simple" | "medium" | "high" | "llm";

// Three presets only. Jobs can override numbers if needed.
export const INGESTION_PRESETS: Record<
  IngestionProfileKey,
  { concurrency: number; batchSize: number }
> = {
  simple: { concurrency: 16, batchSize: 200 }, // light tasks (tickers, SP500)
  medium: { concurrency: 32, batchSize: 400 }, // default
  high: { concurrency: 64, batchSize: 800 }, // heavy; monitor service limits
  llm: { concurrency: 8, batchSize: 50 }, // long-latency or rate-limited LLM calls
};

export function getIngestionPreset(
  profile: IngestionProfileKey = "medium",
  overrides?: { concurrency?: number; batchSize?: number },
) {
  const base = INGESTION_PRESETS[profile] ?? INGESTION_PRESETS.medium;
  const parse = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) && value! > 0 ? value! : fallback;

  return {
    profile,
    concurrency: parse(overrides?.concurrency, base.concurrency),
    batchSize: parse(overrides?.batchSize, base.batchSize),
  };
}
