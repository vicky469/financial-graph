import { decodeHTML } from "entities";
import { LLMSubsidiaryRecord } from "./types";

export type GroundingCorpus = {
  rows: string[];
  rowsNoParens: string[];
  rowSet: Set<string>;
  rowNoParensSet: Set<string>;
};

const PAREN_CONTENT_REGEX = /\([^)]{1,80}\)/g;
const MAX_ROW_WINDOW_SIZE = 3;

export function decodeHtmlEntities(value: string): string {
  return decodeHTML(value);
}

export function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

export function stripHtmlToTextWithLineBreaks(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, "\n")
      .replace(/<\/(ul|ol|table|thead|tbody|tfoot)>/gi, "\n")
      .replace(/<\/td>/gi, "\t")
      .replace(/<[^>]+>/g, " "),
  );
}

export function normalizeForGrounding(value: string): string {
  return decodeHtmlEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeParentheticalText(value: string): string {
  return value.replace(PAREN_CONTENT_REGEX, " ");
}

function splitIntoRows(sourceText: string): string[] {
  const lines = sourceText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  const rows: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    let current = "";
    for (let windowSize = 0; windowSize < MAX_ROW_WINDOW_SIZE; windowSize += 1) {
      const index = i + windowSize;
      if (index >= lines.length) break;
      current = current ? `${current} ${lines[index]}` : lines[index];
      rows.push(current);
    }
  }
  return rows;
}

function normalizeRows(rows: string[]): string[] {
  const normalized = new Set<string>();
  for (const row of rows) {
    const value = normalizeForGrounding(row);
    if (value) {
      normalized.add(value);
    }
  }
  return Array.from(normalized);
}

function includesWithinRows(candidate: string, rows: string[]): boolean {
  for (const row of rows) {
    if (row.includes(candidate)) {
      return true;
    }
  }
  return false;
}

export function buildGroundingCorpus(canonicalSourceText: string): GroundingCorpus {
  const decodedSource = decodeHtmlEntities(canonicalSourceText);
  const rows = splitIntoRows(decodedSource);
  const rowsNoParens = rows.map((row) => removeParentheticalText(row));
  const normalizedRows = normalizeRows(rows);
  const normalizedRowsNoParens = normalizeRows(rowsNoParens);

  return {
    rows: normalizedRows,
    rowsNoParens: normalizedRowsNoParens,
    rowSet: new Set(normalizedRows),
    rowNoParensSet: new Set(normalizedRowsNoParens),
  };
}

export function appearsInCorpus(value: string, corpus: GroundingCorpus): boolean {
  const normalized = normalizeForGrounding(value);
  if (!normalized) return false;
  if (corpus.rowSet.has(normalized) || corpus.rowNoParensSet.has(normalized)) {
    return true;
  }
  if (includesWithinRows(normalized, corpus.rows)) {
    return true;
  }

  const normalizedNoParens = normalizeForGrounding(removeParentheticalText(value));
  if (!normalizedNoParens) {
    return false;
  }
  if (corpus.rowNoParensSet.has(normalizedNoParens)) {
    return true;
  }
  if (includesWithinRows(normalizedNoParens, corpus.rowsNoParens)) {
    return true;
  }

  return includesWithinRows(normalized, corpus.rowsNoParens);
}

export function getGroundingFailureReason(
  record: Pick<LLMSubsidiaryRecord, "name">,
  corpus: GroundingCorpus | null,
): "name_not_in_corpus" | null {
  if (!corpus) {
    return null;
  }

  if (!appearsInCorpus(record.name, corpus)) {
    return "name_not_in_corpus";
  }

  return null;
}
