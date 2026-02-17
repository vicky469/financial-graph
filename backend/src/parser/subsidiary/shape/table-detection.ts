/**
 * Table detection and header parsing utilities
 * 
 * Handles:
 * - Finding subsidiary tables in HTML
 * - Detecting header rows
 * - Extracting column headers
 */

import {
  SUBSIDIARY_KEYWORDS,
  containsAny,
} from "../../../config/subsidiary-keywords";

const MAX_HEADER_SCAN_ROWS = 6;
const MAX_DATA_SCAN_ROWS = 10;
const FOOTER_SAMPLE_ROWS = 5;
const LONG_NARRATIVE_CELL_LEN = 100;
const SHORT_HEADER_LABEL_MAX_LEN = 40;
const MIN_ROW_TEXT_LEN = 3;
const MIN_HEADER_CELLS = 2;

type RowSnapshot = {
  cellCount: number;
  cellTexts: string[];
  nonEmptyTexts: string[];
  text: string;
  hasTh: boolean;
};

type SubsidiaryDataMetrics = {
  subsidiaryDataRows: number;
  totalContentRows: number;
  companyNameRows: number;
  jurisdictionRows: number;
};

// ============================================================================
// Lexical Signals
// ============================================================================

const COMPANY_SUFFIXES = [
  // US
  "inc","inc.","incorporated","corp","corp.","corporation","co","co.","company",
  "llc","l.l.c.","llp","l.l.p.","lp","l.p.","ltd","ltd.","limited",
  "plc","pllc","pc","p.c.","n.a.","na",

  // EU
  "gmbh","ag","kg","kgaa","ug",
  "bv","b.v.","nv","n.v.",
  "sa","s.a.","sarl","s.a.r.l.","spa","s.p.a.","srl","s.r.l.",
  "ab","oy","oyj","as","asa","aps",

  // Asia
  "pte","pte ltd","pte. ltd.","sdn bhd","pty ltd","co ltd","co. ltd","co., ltd.",

  // misc
  "group","holdings","holding","partners","fund","trust","bank","association"
];

/**
 * Detects company/entity-like value tokens in data cells.
 */
export function hasCompanyEntitySuffix(text: string): boolean {
  const lower = text.toLowerCase();
  return COMPANY_SUFFIXES.some((suffix) => lower.includes(suffix));
}

/**
 * Detects jurisdiction-related header keywords (e.g., state/country/incorporation).
 */
export function containsJurisdictionHeaderKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return containsAny(lower, SUBSIDIARY_KEYWORDS.JURISDICTION);
}

/** @deprecated Use hasCompanyEntitySuffix */
export function looksLikeCompanyName(text: string): boolean {
  return hasCompanyEntitySuffix(text);
}

/** @deprecated Use containsJurisdictionHeaderKeyword */
export function looksLikeJurisdiction(text: string): boolean {
  return containsJurisdictionHeaderKeyword(text);
}

function looksLikeOwnershipValue(text: string): boolean {
  return /\b\d{1,3}(?:\.\d+)?%\b/.test(text);
}

function looksLikeJurisdictionValue(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (/\d/.test(trimmed)) return false;
  if (looksLikeOwnershipValue(trimmed)) return false;
  if (hasCompanyEntitySuffix(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (containsAny(lower, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME)) return false;
  if (containsAny(lower, SUBSIDIARY_KEYWORDS.PERCENTAGE)) return false;

  return /^[A-Za-z][A-Za-z .,&'()/-]*$/.test(trimmed);
}

// ============================================================================
// Row Snapshot + Scoring Helpers
// ============================================================================

function snapshotRow($: any, row: any): RowSnapshot {
  const $row = $(row);
  const cells = $row.find("td, th");
  const cellTexts = cells.map((_: any, cell: any) => $(cell).text().trim()).get();
  return {
    cellCount: cells.length,
    cellTexts,
    nonEmptyTexts: cellTexts.filter((text: string) => text.length > 0),
    text: $row.text().toLowerCase(),
    hasTh: $row.find("th").length > 0,
  };
}

function isLongSingleCellNarrative(row: RowSnapshot): boolean {
  return row.cellCount === 1 && (row.cellTexts[0]?.length ?? 0) > LONG_NARRATIVE_CELL_LEN;
}

function shouldSkipDataScanRow(row: RowSnapshot): boolean {
  return row.nonEmptyTexts.length === 0 || isLongSingleCellNarrative(row);
}

function getRowSubsidiarySignals(texts: string[]) {
  const hasCompanyName = texts.some((text: string) => hasCompanyEntitySuffix(text));
  const hasJurisdiction = texts.some(
    (text: string) =>
      containsJurisdictionHeaderKeyword(text) || looksLikeJurisdictionValue(text),
  );
  const hasMultipleCells = texts.filter((text: string) => text.length > 0).length >= 2;

  return { hasCompanyName, hasJurisdiction, hasMultipleCells };
}

function createEmptyDataMetrics(): SubsidiaryDataMetrics {
  return {
    subsidiaryDataRows: 0,
    totalContentRows: 0,
    companyNameRows: 0,
    jurisdictionRows: 0,
  };
}

function qualifiesAsSubsidiaryData(metrics: SubsidiaryDataMetrics): boolean {
  // For single-row pattern: require at least 3 complete subsidiary rows
  if (
    metrics.subsidiaryDataRows >= 3 &&
    metrics.totalContentRows > 0 &&
    metrics.subsidiaryDataRows / metrics.totalContentRows >= 0.3
  ) {
    return true;
  }

  // For multi-row pattern: require both company names AND jurisdictions present.
  return (
    metrics.companyNameRows >= 2 &&
    metrics.jurisdictionRows >= 2 &&
    metrics.totalContentRows >= 4
  );
}

// ============================================================================
// Core Detection Implementations
// ============================================================================

function isLikelyHeaderLabelImpl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/\d/.test(trimmed)) return false;
  if (
    hasCompanyEntitySuffix(trimmed) ||
    containsJurisdictionHeaderKeyword(trimmed)
  ) {
    return false;
  }
  return trimmed.length <= SHORT_HEADER_LABEL_MAX_LEN && /[a-z]/i.test(trimmed);
}

function isPossibleHeaderRowTextImpl(name: string, jurisdiction: string): boolean {
  const combined = `${name} ${jurisdiction}`.toLowerCase();
  return isHeaderKeywordRowImpl(combined);
}

/**
 * Check if a table is likely a footer/note table rather than a continuation table
 */
function isLikelyFooterTableImpl($: any, table: any): boolean {
  const rows = table.find("tr");
  const text = table.text().toLowerCase();
  
  // Check for footer keywords using the centralized keyword set
  if (containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS)) return true;
  
  // Check if cells have long text (>100 chars)
  let longCells = 0, totalCells = 0;
  rows.slice(0, FOOTER_SAMPLE_ROWS).each((_: any, tr: any) => {
    $(tr).find("td").each((_: any, td: any) => {
      totalCells++;
      if ($(td).text().trim().length > LONG_NARRATIVE_CELL_LEN) longCells++;
    });
  });
  if (totalCells > 0 && longCells / totalCells > 0.5) return true;
  
  return false;
}

/**
 * Check if a table contains subsidiary data even without explicit headers
 * This handles cases where tables go straight to data without header rows
 */
function hasSubsidiaryDataImpl($: any, table: any): boolean {
  const rows = table.find("tr");
  if (rows.length < 2) return false;

  const metrics = createEmptyDataMetrics();

  // Scan first rows and accumulate row-level data signals.
  rows.slice(0, MAX_DATA_SCAN_ROWS).each((_: any, row: any) => {
    const rowSnapshot = snapshotRow($, row);
    if (shouldSkipDataScanRow(rowSnapshot)) return;

    metrics.totalContentRows++;

    const { hasCompanyName, hasJurisdiction, hasMultipleCells } =
      getRowSubsidiarySignals(rowSnapshot.cellTexts);

    if (hasCompanyName) metrics.companyNameRows++;
    if (hasJurisdiction) metrics.jurisdictionRows++;

    // Single-row pattern: require both company name AND jurisdiction patterns
    if (hasCompanyName && hasJurisdiction && hasMultipleCells) {
      metrics.subsidiaryDataRows++;
    }
    // Multi-row pattern: company name OR jurisdiction (but not both in same row)
    else if ((hasCompanyName || hasJurisdiction) && hasMultipleCells) {
      metrics.subsidiaryDataRows++;
    }
  });

  return qualifiesAsSubsidiaryData(metrics);
}

/**
 * Find all tables that look like subsidiary tables
 */
function findAllSubsidiaryTablesImpl($: any, tables: any): any[] {
  const subsidiaryTables: any[] = [];
  
  tables.each((_: number, tbl: any) => {
    const $tbl = $(tbl);
    const rows = $tbl.find("tr");
    if (rows.length < 2) return;

    let score = 0;

    // Check first 3 rows for keywords
    const headerText = rows.slice(0, 3).text();
    if (containsAny(headerText, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME)) score += 3;
    if (containsAny(headerText, SUBSIDIARY_KEYWORDS.JURISDICTION)) score += 3;

    // If score is high enough, it's likely a subsidiary table
    if (score >= 3) {
      subsidiaryTables.push($tbl);
    }
  });

  return subsidiaryTables;
}

/**
 * Find the header row index in a table - check first 6 rows to handle cases with descriptive text
 */
function findHeaderRowImpl($: any, rows: any): number {
  // Check first rows for the best header match
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS, rows.length); i++) {
    const row = snapshotRow($, rows[i]);

    // Skip empty rows
    if (row.text.trim().length < MIN_ROW_TEXT_LEN) continue;

    // Skip rows that are clearly descriptive text (long single-cell content)
    if (isLongSingleCellNarrative(row)) continue;

    // If row has both name and jurisdiction keywords AND has multiple cells, it's likely a header
    if (isHeaderKeywordRowImpl(row.text) && row.cellCount >= MIN_HEADER_CELLS) {
      return i;
    }
  }
  
  // Fallback: check for TH elements in first rows
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS, rows.length); i++) {
    if (snapshotRow($, rows[i]).hasTh) {
      return i;
    }
  }

  const inferred = inferHeaderRowIndex($, rows);
  if (inferred !== -1) return inferred;
  
  return -1; // No header found
}

/**
 * Filter cells to only include those with actual content
 * Skips empty width-defining cells (common in SEC filings with colspan tables)
 *
 * A cell is considered to have content if:
 * - It has non-empty text content (after removing zero-width characters)
 * - Zero-width characters (U+200B-U+200D, U+FEFF) are not considered content
 */
function normalizeCellText(text: string): string {
  return text.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
}

// ============================================================================
// Cell Filtering + Header Extraction
// ============================================================================

function getCellContentTextImpl($: any, cell: any): string {
  return normalizeCellText($(cell).text());
}

function isLayoutOnlyCellImpl($: any, cell: any): boolean {
  return getCellContentTextImpl($, cell).length === 0;
}

function filterContentCellsImpl($: any, cells: any): any {
  return cells.filter((_: number, td: any) => !isLayoutOnlyCellImpl($, td));
}

/**
 * Extract column headers from a header row
 */
function extractHeadersImpl($: any, headerRow: any): string[] {
  const headers: string[] = [];
  const allCells = $(headerRow).find("th, td");
  const cells = filterContentCellsImpl($, allCells);

  cells.each((_: any, cell: any) => {
      let text = normalizeCellText($(cell).text())
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) text = `Column_${headers.length}`;
      headers.push(text);
    });

  return headers;
}

// ============================================================================
// Row-Level Header Guard
// ============================================================================

/**
 * Check if a row is a header row (not data)
 */
function isHeaderRowImpl(name: string, jurisdiction: string): boolean {
  const nameLower = name.toLowerCase();
  const text = (name + " " + jurisdiction).toLowerCase();
  
  // If name is just a year (e.g., "2023", "2024"), it's a sub-header row
  if (/^(19|20)\d{2}$/.test(name.trim())) return true;
  
  // If name looks like an actual company name, it's NOT a header
  const companyIndicators = ["llc", "inc.", "corp", "ltd", "l.l.c", "s.a.", "gmbh", "b.v.", "pty", "plc", "n.v."];
  if (companyIndicators.some(ind => nameLower.includes(ind))) return false;
  
  if (isPossibleHeaderRowTextImpl(name, jurisdiction)) return true;
  
  // Check for title markers, but exclude common false positives
  // "United States" should not trigger "state" keyword
  // "Corporation" in name should not trigger "organization" keyword
  const hasStateKeyword = text.includes("state") && !text.includes("united states");
  const hasOrgKeyword = text.includes("organization") && !text.includes("corporation");
  const hasCompanyKeyword = text.includes("company") && text.includes("name"); // Only if paired with "name"
  
  // Check for ownership header keywords, but NOT ownership values like "(32.5%)"
  // Header patterns: "% Owned", "Ownership %", "Percent Owned"
  // Data patterns: "(32.5%)", "(100%)" - these have digits before %
  const hasOwnershipHeader = (text.includes("percent") || text.includes("ownership")) && 
                             !text.match(/\(\d+(?:\.\d+)?%\)/); // Exclude "(32.5%)" patterns
  
  return hasStateKeyword || hasOrgKeyword || hasCompanyKeyword ||
         text.includes("subsidiary") || text.includes("subsidiaries") ||
         text.includes("entity") || text.includes("jurisdiction") ||
         text.includes("incorporation") || text.includes("country") ||
         text.includes("location") || text.includes("organized") ||
         text.includes("domicile") ||
         hasOwnershipHeader;
}

/**
 * Shared header keyword detection used by header row parsing and validation.
 */
function isHeaderKeywordRowImpl(text: string): boolean {
  return (
    containsAny(text, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) &&
    containsAny(text, SUBSIDIARY_KEYWORDS.JURISDICTION)
  );
}

function inferHeaderRowIndex($: any, rows: any): number {
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS, rows.length - 1); i++) {
    const row = snapshotRow($, rows[i]);
    if (row.cellCount < MIN_HEADER_CELLS) continue;

    if (row.nonEmptyTexts.length < MIN_HEADER_CELLS) continue;

    const headerLike = row.nonEmptyTexts.every((text: string) =>
      isLikelyHeaderLabelImpl(text),
    );
    if (!headerLike) continue;

    // Guard: inferred headers should still contain at least one known
    // header keyword (name/entity/subsidiary/state/country/etc.).
    // This prevents all-caps data rows from being misclassified as headers.
    const combinedHeaderText = row.nonEmptyTexts.join(" ").toLowerCase();
    if (!containsAny(combinedHeaderText, SUBSIDIARY_KEYWORDS.TITLE_MARKERS)) {
      continue;
    }

    const nextRow = snapshotRow($, rows[i + 1]);

    if (nextRow.nonEmptyTexts.length < MIN_HEADER_CELLS) continue;

    const nextHasDataSignals = nextRow.nonEmptyTexts.some(
      (text: string) =>
        hasCompanyEntitySuffix(text) ||
        containsJurisdictionHeaderKeyword(text) ||
        looksLikeOwnershipValue(text),
    );

    if (nextHasDataSignals) {
      return i;
    }
  }

  return -1;
}

// ============================================================================
// Public Entry Points
// ============================================================================

export function isLikelyHeaderLabel(text: string): boolean {
  return isLikelyHeaderLabelImpl(text);
}

export function isPossibleHeaderRowText(name: string, jurisdiction: string): boolean {
  return isPossibleHeaderRowTextImpl(name, jurisdiction);
}

export function isHeaderKeywordRow(text: string): boolean {
  return isHeaderKeywordRowImpl(text);
}

export function isLikelyFooterTable($: any, table: any): boolean {
  return isLikelyFooterTableImpl($, table);
}

export function hasSubsidiaryData($: any, table: any): boolean {
  return hasSubsidiaryDataImpl($, table);
}

export function findAllSubsidiaryTables($: any, tables: any): any[] {
  return findAllSubsidiaryTablesImpl($, tables);
}

export function findHeaderRow($: any, rows: any): number {
  return findHeaderRowImpl($, rows);
}

export function getCellContentText($: any, cell: any): string {
  return getCellContentTextImpl($, cell);
}

export function isLayoutOnlyCell($: any, cell: any): boolean {
  return isLayoutOnlyCellImpl($, cell);
}

export function filterContentCells($: any, cells: any): any {
  return filterContentCellsImpl($, cells);
}

export function extractHeaders($: any, headerRow: any): string[] {
  return extractHeadersImpl($, headerRow);
}

export function isHeaderRow(name: string, jurisdiction: string): boolean {
  return isHeaderRowImpl(name, jurisdiction);
}
