/**
 * Per-target execution: decompress cached HTML and run the parser.
 */

import fs from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { createLogger, withLogMetadata } from "../../utils/logger";
import { parseExhibit, DEFAULT_CONFIG } from "../../parser/subsidiary";
import { buildFailedParseResult } from "./util";
import type {
  ValidatedFiling,
  SECFilingTarget,
  SubsidiaryFallbackPolicy,
} from "./types";

const logger = createLogger("pipeline/subsidiary/target");
const gunzipAsync = promisify(gunzip);

async function decompressContent(cachePath: string): Promise<Buffer> {
  const compressedData = await fs.readFile(cachePath);
  const decompressed = await gunzipAsync(compressedData);
  return decompressed;
}

export async function parseSubsidiaryTarget(
  target: SECFilingTarget,
  options: { fallbackPolicy?: SubsidiaryFallbackPolicy } = {},
): Promise<ValidatedFiling> {
  return withLogMetadata(
    { correlationId: target.accessionNumberNoDashes },
    async () => {
      try {
        const contentBuffer = await decompressContent(target.cachePath);
        const fallbackPolicy = options.fallbackPolicy ?? "llm";

        // Check if it's a PDF or HTML
        const header = contentBuffer.slice(0, 5).toString("utf-8");
        const isPDF = header.startsWith("%PDF-");

        // Convert to string only for HTML, keep as buffer for PDF
        const content = isPDF
          ? contentBuffer.toString("latin1")
          : contentBuffer.toString("utf-8");

        const parseResult = await parseExhibit(
          content,
          {
            accession_number: target.accessionNumberNoDashes,
            cik: target.cik,
            filingCompanyId: target.companyId,
            filingCompanyName: target.companyName,
          },
          { ...DEFAULT_CONFIG, fallbackPolicy },
        );

        const isSuccessful = parseResult.status !== "failed";

        return {
          ...target,
          parseResult,
          valid: isSuccessful,
          issues: isSuccessful ? [] : [parseResult.errorMessage || "Parse failed"],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Parse failed:", {
          error: message,
        });

        return {
          ...target,
          parseResult: buildFailedParseResult(message),
          valid: false,
          issues: [message],
        };
      }
    },
  );
}
