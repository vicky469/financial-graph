/**
 * Shared utilities for the subsidiary pipeline.
 */

import type { ParseResult, ValidatedFiling } from "./types";

export function formatRunTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}_${ms}`;
}

const DOUBLE_QUOTE_CHARS = /["\u201C\u201D]/g;

export function sanitizeSubsidiaryNameForSink(name: string): string {
  return name
    .replace(DOUBLE_QUOTE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeForSinks(filing: ValidatedFiling): ValidatedFiling {
  const subsidiaries = filing.parseResult?.subsidiaries;
  if (!subsidiaries || subsidiaries.length === 0) {
    return filing;
  }

  return {
    ...filing,
    parseResult: {
      ...filing.parseResult,
      subsidiaries: subsidiaries.map((sub) => ({
        ...sub,
        name: sanitizeSubsidiaryNameForSink(sub.name || ""),
      })),
    },
  };
}

export function buildFailedParseResult(errorMessage: string): ParseResult {
  return {
    subsidiaries: [],
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
