/**
 * Subsidiary parsing pipeline for cached SEC exhibits.
 *
 * Handles decompression, parsing, fallback policy, and safe error handling.
 */

import fs from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { createLogger } from "../../utils/logger";
import type {
  ValidatedFiling,
  SECFilingTarget,
  ParseResult,
} from "../../jobs/parse_subsidiaries/types";
import type { SubsidiaryFallbackPolicy } from "./types";
import { parseFiling } from "./parse";

const logger = createLogger("pipeline/subsidiary");
const gunzipAsync = promisify(gunzip);

async function decompressHtml(cachePath: string): Promise<string> {
  const compressedData = await fs.readFile(cachePath);
  const decompressed = await gunzipAsync(compressedData);
  return decompressed.toString("utf-8");
}

function buildFailedParseResult(errorMessage: string): ParseResult {
  return {
    subsidiaries: [],
    method: "heuristic",
    status: "failed",
    classification: "failed",
    tableCount: 0,
    maxNestingLevel: 0,
    footnotesHtml: "",
    errorMessage,
  };
}

export async function parseSubsidiaryTarget(
  target: SECFilingTarget,
  options: { fallbackPolicy?: SubsidiaryFallbackPolicy } = {},
): Promise<ValidatedFiling> {
  const html = await decompressHtml(target.cachePath);
  const parsed = await parseFiling({ ...target, html }, options);
  const isSuccessful = parsed.parseResult.status !== "failed";

  return {
    ...parsed,
    valid: isSuccessful,
    issues: isSuccessful ? [] : [parsed.parseResult.errorMessage || "Parse failed"],
  };
}

export async function parseSubsidiaryTargetSafe(
  target: SECFilingTarget,
  options: { fallbackPolicy?: SubsidiaryFallbackPolicy } = {},
): Promise<ValidatedFiling> {
  try {
    return await parseSubsidiaryTarget(target, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Process step failed for ${target.accessionNumberNoDashes}:`, {
      error: message,
    });

    return {
      ...target,
      parseResult: buildFailedParseResult(message),
      valid: false,
      issues: [message],
    };
  }
}
