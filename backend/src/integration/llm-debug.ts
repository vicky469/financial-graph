import fs from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../utils/logger";

const logger = createLogger("integration/llm-debug");

const DEFAULT_RAW_RESPONSE_PREVIEW_MAX = 8000;
const DEFAULT_LLM_RAW_RESPONSE_LOG_MAX_CHARS = 40_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const LLM_RAW_RESPONSE_LOG_ENABLED = parseBoolean(
  process.env.LLM_RAW_RESPONSE_LOG_ENABLED,
  true,
);
const LLM_RAW_RESPONSE_LOG_MAX_CHARS = parsePositiveInt(
  process.env.LLM_RAW_RESPONSE_LOG_MAX_CHARS,
  DEFAULT_LLM_RAW_RESPONSE_LOG_MAX_CHARS,
);
const LLM_RAW_RESPONSE_LOG_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "llm_raw_responses",
);

export function buildRawResponsePreview(
  responseText: string,
  maxChars: number = DEFAULT_RAW_RESPONSE_PREVIEW_MAX,
): string {
  if (responseText.length <= maxChars) {
    return responseText;
  }

  const half = Math.floor(maxChars / 2);
  const omitted = responseText.length - maxChars;
  return (
    responseText.slice(0, half) +
    `\n... [truncated ${omitted} chars] ...\n` +
    responseText.slice(-half)
  );
}

function truncateForSnapshot(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const omitted = text.length - maxChars;
  return `${text.slice(0, maxChars)}\n\n[truncated ${omitted} chars for raw response snapshot]\n`;
}

function sanitizeSegment(value: string | undefined): string {
  if (!value) return "unknown";
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "unknown";
}

function formatTimestamp(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

export type RawResponseSnapshotInput = {
  provider: string;
  model?: string;
  requestType?: string;
  accessionNumber?: string;
  reason?: string;
  content: string;
};

export async function writeRawResponseSnapshot(
  input: RawResponseSnapshotInput,
): Promise<string | null> {
  if (!LLM_RAW_RESPONSE_LOG_ENABLED || !input.content) {
    return null;
  }

  try {
    await fs.mkdir(LLM_RAW_RESPONSE_LOG_DIR, { recursive: true });

    const fileName = [
      sanitizeSegment(input.accessionNumber),
      sanitizeSegment(input.provider),
      sanitizeSegment(input.reason ?? "response"),
      formatTimestamp(),
    ].join("_") + ".txt";

    const filePath = path.join(LLM_RAW_RESPONSE_LOG_DIR, fileName);
    const metadataLines = [
      `provider: ${input.provider}`,
      `model: ${input.model || "unknown"}`,
      `request_type: ${input.requestType || "unknown"}`,
      `accession_number: ${input.accessionNumber || "unknown"}`,
      `reason: ${input.reason || "unknown"}`,
      `captured_at: ${new Date().toISOString()}`,
      "",
      "---",
      "",
    ];

    const body = truncateForSnapshot(
      input.content,
      LLM_RAW_RESPONSE_LOG_MAX_CHARS,
    );

    await fs.writeFile(filePath, `${metadataLines.join("\n")}${body}`, "utf8");
    return filePath;
  } catch (error) {
    logger.warn("Failed writing LLM raw response snapshot", {
      provider: input.provider,
      model: input.model,
      requestType: input.requestType,
      accessionNumber: input.accessionNumber,
      reason: input.reason,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
