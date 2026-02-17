import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createLogger } from "../../utils/logger";
import { stripHtmlToTextWithLineBreaks } from "./grounding";

const logger = createLogger("validation/llm-fallback");
const execFileAsync = promisify(execFile);

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const LLM_FALLBACK_WRITE_SOURCE_MD = false;
const LLM_FALLBACK_SOURCE_MAX_CHARS = parsePositiveInt(
  process.env.LLM_FALLBACK_SOURCE_MAX_CHARS,
  1_000_000,
);
const PDFTOTEXT_TIMEOUT_MS = parsePositiveInt(
  process.env.PDFTOTEXT_TIMEOUT_MS,
  30_000,
);
const PDFTOTEXT_MAX_BUFFER_BYTES = parsePositiveInt(
  process.env.PDFTOTEXT_MAX_BUFFER_BYTES,
  30_000_000,
);
const LLM_FALLBACK_SOURCE_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "llm_source_markdown",
);
const LLM_FALLBACK_PDF_TEMP_DIR = path.resolve(
  os.tmpdir(),
  "financial-graph",
  "llm-fallback",
);

let hasLoggedMissingPdfToText = false;

function extractPrintablePdfText(content: string): string {
  // Best-effort fallback for raw PDF bytes. This captures visible ASCII runs only.
  const matches = content.match(/[\x20-\x7e]{4,}/g);
  if (!matches) return "";
  return matches.join("\n");
}

function normalizeCanonicalSourceText(text: string): string {
  const normalizedLines = text
    .replace(/\0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
  return normalizedLines.join("\n");
}

async function extractPdfTextWithPdftotext(
  pdfContent: string,
  accessionNumber: string,
): Promise<string> {
  const tempSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const tempFilePath = path.join(
    LLM_FALLBACK_PDF_TEMP_DIR,
    `${accessionNumber}_${tempSuffix}.pdf`,
  );

  try {
    await fs.mkdir(LLM_FALLBACK_PDF_TEMP_DIR, { recursive: true });
    const pdfBuffer = Buffer.from(pdfContent, "latin1");
    await fs.writeFile(tempFilePath, pdfBuffer);

    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", tempFilePath, "-"],
      {
        timeout: PDFTOTEXT_TIMEOUT_MS,
        maxBuffer: PDFTOTEXT_MAX_BUFFER_BYTES,
      },
    );
    return stdout || "";
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (errorCode === "ENOENT") {
      if (!hasLoggedMissingPdfToText) {
        logger.warn(
          "pdftotext command not found; falling back to printable PDF text extraction",
        );
        hasLoggedMissingPdfToText = true;
      }
      return "";
    }

    logger.warn(
      `pdftotext extraction failed for ${accessionNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "";
  } finally {
    await fs.unlink(tempFilePath).catch(() => undefined);
  }
}

function truncateForSourceMarkdown(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const omitted = text.length - maxChars;
  return (
    text.slice(0, maxChars) +
    `\n\n[truncated ${omitted} chars for source markdown dump]\n`
  );
}

async function writeSourceMarkdownFile(
  accessionNumber: string,
  classification: string,
  markdown: string,
): Promise<void> {
  if (!LLM_FALLBACK_WRITE_SOURCE_MD || !markdown) return;

  try {
    const safeClassification =
      classification
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "unknown";
    await fs.mkdir(LLM_FALLBACK_SOURCE_DIR, { recursive: true });
    const filePath = path.join(
      LLM_FALLBACK_SOURCE_DIR,
      `${accessionNumber}_${safeClassification}.md`,
    );
    const finalContent = truncateForSourceMarkdown(
      markdown,
      LLM_FALLBACK_SOURCE_MAX_CHARS,
    );
    await fs.writeFile(filePath, finalContent, "utf8");
  } catch (error) {
    logger.warn(
      `Failed writing canonical source markdown for ${accessionNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function buildCanonicalSourceText(
  doc: string,
  classification: string,
  accessionNumber: string,
): Promise<string> {
  let sourceText = "";

  if (classification === "pdf-based") {
    sourceText = await extractPdfTextWithPdftotext(doc, accessionNumber);
    if (!sourceText) {
      sourceText = extractPrintablePdfText(doc);
      if (sourceText) {
        logger.warn(
          `Using printable-text PDF fallback for ${accessionNumber}; pdftotext yielded no text`,
        );
      }
    }
  } else {
    sourceText = stripHtmlToTextWithLineBreaks(doc);
  }

  const normalizedText = normalizeCanonicalSourceText(sourceText);
  if (!normalizedText) {
    return "";
  }

  const markdown = `# Canonical Source\n\n${normalizedText}`;
  await writeSourceMarkdownFile(accessionNumber, classification, markdown);
  return normalizedText;
}
