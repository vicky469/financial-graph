/**
 * Shared utilities for the subsidiary pipeline.
 */

import type { ParseResult } from "./types";

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
