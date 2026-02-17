import * as cheerio from "cheerio";
type CheerioAPI = ReturnType<typeof cheerio.load>;

import { createLogger } from "../../../utils/logger";

import type { TableInfo } from "../parser-types";
import { DocumentClassification, TableType } from "../parser-types";
import {
  findHeaderRow,
  extractHeaders,
  isLikelyFooterTable,
  hasSubsidiaryData,
} from "./table-detection";
import {
  SUBSIDIARY_KEYWORDS,
  containsAny,
} from "../../../config/subsidiary-keywords";

const logger = createLogger("parsers/subsidiary/table-classifier");

type TableScanContext = {
  lastSubsidiaryHeaders: string[] | null;
  lastSubsidiaryColumnCount: number;
};

export type TableScanResult = {
  allTables: TableInfo[];
  subsidiaryTables: TableInfo[];
};

// ============================================================================
// Shared Builders
// ============================================================================

function createTableInfo({
  index,
  type,
  rowCount,
  columnCount,
  headers,
  isContinuation = false,
  cachedHeaders,
}: {
  index: number;
  type: TableType;
  rowCount: number;
  columnCount: number;
  headers: string[] | null;
  isContinuation?: boolean;
  cachedHeaders?: string[];
}): TableInfo {
  return {
    index,
    type,
    rowCount,
    columnCount,
    headers,
    isContinuation,
    cachedHeaders,
  };
}

function createContinuationTableInfo(
  tableIndex: number,
  rowCount: number,
  context: TableScanContext,
): TableInfo {
  return createTableInfo({
    index: tableIndex,
    type: TableType.SUBSIDIARY,
    rowCount,
    columnCount: context.lastSubsidiaryColumnCount,
    headers: null,
    isContinuation: true,
    cachedHeaders: context.lastSubsidiaryHeaders || undefined,
  });
}

// ============================================================================
// Low-Level Structure Helpers
// ============================================================================

function calculateColumnsFromCells($: CheerioAPI, cells: any): number {
  let columnCount = 0;
  cells.each((_: number, cell: any) => {
    const colspan = parseInt($(cell).attr("colspan") || "1", 10);
    columnCount += Number.isFinite(colspan) && colspan > 0 ? colspan : 1;
  });
  return columnCount;
}

function calculateColumnCount($: CheerioAPI, rows: any): number {
  let columnCount = 0;

  rows.each((_: number, tr: any) => {
    if (columnCount > 0) return false;

    const cells = $(tr).find("td, th");
    if (cells.length === 0) return;

    const hasVisibleContent = cells
      .map((__: number, cell: any) => $(cell).text().trim())
      .get()
      .some((text: string) => text.length > 0);

    if (!hasVisibleContent) return;

    columnCount = calculateColumnsFromCells($, cells);
    if (columnCount > 0) return false;
  });

  return columnCount;
}

function isContinuationTableCandidate(
  context: TableScanContext,
  currentColumnCount: number,
): boolean {
  if (!context.lastSubsidiaryHeaders || context.lastSubsidiaryHeaders.length === 0) {
    return false;
  }
  if (context.lastSubsidiaryColumnCount <= 0 || currentColumnCount <= 0) {
    return false;
  }

  if (context.lastSubsidiaryColumnCount === currentColumnCount) {
    return true;
  }

  // SEC/Wdesk tables often include spacer columns in header tables.
  // Allow structural mismatch when current table still has meaningful columns.
  if (
    currentColumnCount >= 2 &&
    currentColumnCount < context.lastSubsidiaryColumnCount
  ) {
    return true;
  }

  return false;
}

function isSingleRowFootnoteTable($table: any, rows: any): boolean {
  if (rows.length !== 1) return false;

  const text = $table.text().trim().toLowerCase();
  return (
    containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS) || text.length > 50
  );
}

function isFootnoteReferenceTable($: CheerioAPI, rows: any): boolean {
  if (rows.length === 0 || rows.length > 5) {
    return false;
  }

  let hasFootnoteRef = false;
  let hasNarrative = false;

  rows.each((_: number, tr: any) => {
    const texts = $(tr)
      .find("td, th")
      .map((__: number, cell: any) => $(cell).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((text: string) => text.length > 0);

    if (texts.length === 0) {
      return;
    }

    if (/^\(\d+\)$/.test(texts[0])) {
      hasFootnoteRef = true;
      if (texts.length >= 2 && texts[1].length >= 30) {
        hasNarrative = true;
      }
    }
  });

  return hasFootnoteRef && hasNarrative;
}

// ============================================================================
// Classification Pipeline
// ============================================================================

function classifyHeaderedTable(
  $: CheerioAPI,
  rows: any,
  tableIndex: number,
  headerRowIndex: number,
  context: TableScanContext,
): TableInfo {
  const headers = extractHeaders($, rows[headerRowIndex]);
  const headerText = headers.join(" ").toLowerCase();
  const hasSubsidiaryKeywords =
    containsAny(headerText, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) &&
    containsAny(headerText, SUBSIDIARY_KEYWORDS.JURISDICTION);

  const headerCells = $(rows[headerRowIndex]).find("td, th");
  const headerColumnCount = calculateColumnsFromCells($, headerCells);
  const fallbackColumnCount = calculateColumnCount($, rows);
  const columnCount = headerColumnCount > 0 ? headerColumnCount : fallbackColumnCount;
  const dataRowCount = Math.max(rows.length - (headerRowIndex + 1), 0);

  if (!hasSubsidiaryKeywords) {
    logger.debug(`Table ${tableIndex}: header found but no subsidiary keywords`);
    return createTableInfo({
      index: tableIndex,
      type: TableType.UNKNOWN,
      rowCount: dataRowCount,
      columnCount,
      headers,
    });
  }

  context.lastSubsidiaryHeaders = headers;
  context.lastSubsidiaryColumnCount = columnCount;

  logger.debug(
    `Table ${tableIndex}: subsidiary header table (${columnCount} columns, ${dataRowCount} data rows)`,
  );
  return createTableInfo({
    index: tableIndex,
    type: TableType.SUBSIDIARY,
    rowCount: dataRowCount,
    columnCount,
    headers,
  });
}

function classifyHeaderlessTable(
  $: CheerioAPI,
  $table: any,
  rows: any,
  tableIndex: number,
  context: TableScanContext,
): TableInfo {
  const tableText = $table.text().trim().toLowerCase();
  const columnCount = calculateColumnCount($, rows);

  if (isLikelyFooterTable($, $table)) {
    logger.debug(`Table ${tableIndex}: identified as footer table`);
    return createTableInfo({
      index: tableIndex,
      type: TableType.FOOTNOTE,
      rowCount: rows.length,
      columnCount,
      headers: [],
    });
  }

  if (isFootnoteReferenceTable($, rows)) {
    logger.debug(`Table ${tableIndex}: footnote-reference table`);
    return createTableInfo({
      index: tableIndex,
      type: TableType.FOOTNOTE,
      rowCount: rows.length,
      columnCount,
      headers: [],
    });
  }

  if (containsAny(tableText, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS)) {
    logger.debug(`Table ${tableIndex}: note-like content without table headers`);
    return createTableInfo({
      index: tableIndex,
      type: TableType.FOOTNOTE,
      rowCount: rows.length,
      columnCount,
      headers: [],
    });
  }

  if (hasSubsidiaryData($, $table)) {
    if (isContinuationTableCandidate(context, columnCount)) {
      logger.debug(`Table ${tableIndex}: continuation table (detected subsidiary data)`);
      return createContinuationTableInfo(tableIndex, rows.length, context);
    }

    logger.debug(`Table ${tableIndex}: found headerless subsidiary data`);
    return createTableInfo({
      index: tableIndex,
      type: TableType.SUBSIDIARY,
      rowCount: rows.length,
      columnCount,
      headers: null,
    });
  }

  if (isContinuationTableCandidate(context, columnCount)) {
    logger.debug(`Table ${tableIndex}: continuation table`);
    return createContinuationTableInfo(tableIndex, rows.length, context);
  }

  logger.debug(`Table ${tableIndex}: headerless non-subsidiary table`);
  return createTableInfo({
    index: tableIndex,
    type: TableType.UNKNOWN,
    rowCount: rows.length,
    columnCount,
    headers: [],
  });
}

function classifyTable(
  $: CheerioAPI,
  $table: any,
  rows: any,
  tableIndex: number,
  context: TableScanContext,
): TableInfo {
  if (isSingleRowFootnoteTable($table, rows)) {
    logger.debug(`Table ${tableIndex}: single-row note-like table`);
    return createTableInfo({
      index: tableIndex,
      type: TableType.FOOTNOTE,
      rowCount: 1,
      columnCount: calculateColumnCount($, rows),
      headers: [],
    });
  }

  if (rows.length < 2) {
    return createTableInfo({
      index: tableIndex,
      type: TableType.UNKNOWN,
      rowCount: 0,
      columnCount: 0,
      headers: [],
    });
  }

  const headerRowIndex = findHeaderRow($, rows);
  if (headerRowIndex >= 0) {
    return classifyHeaderedTable($, rows, tableIndex, headerRowIndex, context);
  }

  return classifyHeaderlessTable($, $table, rows, tableIndex, context);
}

// ============================================================================
// Top-Level Classification
// ============================================================================

function scanTablesImpl($: CheerioAPI, tables: any): TableScanResult {
  const context: TableScanContext = {
    lastSubsidiaryHeaders: null,
    lastSubsidiaryColumnCount: 0,
  };
  const allTables: TableInfo[] = [];

  tables.each((tableIndex: number, table: any) => {
    const $table = $(table);
    const rows = $table.find("tr");
    const tableInfo = classifyTable($, $table, rows, tableIndex, context);
    allTables.push(tableInfo);
  });

  return {
    allTables,
    subsidiaryTables: allTables.filter((table) => table.type === TableType.SUBSIDIARY),
  };
}

function classifyDocumentImpl(
  subsidiaryTables: TableInfo[],
): DocumentClassification {
  if (subsidiaryTables.length === 0) {
    return DocumentClassification.HAS_TABLE_NO_DATA;
  }

  const tablesWithData = subsidiaryTables.filter((t) => t.rowCount > 0);
  if (tablesWithData.length === 0) {
    return DocumentClassification.HAS_TABLE_NO_DATA;
  }

  if (subsidiaryTables.length === 1) {
    return DocumentClassification.SINGLE_TABLE;
  }
  return DocumentClassification.MULTI_TABLE;
}

// ============================================================================
// Public Entry Points
// ============================================================================

export function scanTables($: CheerioAPI, tables: any): TableScanResult {
  return scanTablesImpl($, tables);
}

export function classifyDocument(
  subsidiaryTables: TableInfo[],
): DocumentClassification {
  return classifyDocumentImpl(subsidiaryTables);
}
