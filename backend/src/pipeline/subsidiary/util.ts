/**
 * Shared utilities for the subsidiary pipeline.
 */

import type { ParseResult } from "./types";

export function buildFailedParseResult(errorMessage: string): ParseResult {
  return {
    subsidiaries: [],
    method: "unknown",
    llmApplied: false,
    llmModified: false,
    status: "failed",
    classification: "failed",
    tableCount: 0,
    maxNestingLevel: 0,
    footnotesHtml: "",
    errorMessage,
  };
}
