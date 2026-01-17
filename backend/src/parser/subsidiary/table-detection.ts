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
} from "../../config/subsidiary-keywords";

/**
 * Check if a table is likely a footer/note table rather than a continuation table
 */
export function isLikelyFooterTable($: any, table: any): boolean {
  const rows = table.find("tr");
  const text = table.text().toLowerCase();
  
  // Check for footer keywords using the centralized keyword set
  if (containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS)) return true;
  
  // Check if cells have long text (>100 chars)
  let longCells = 0, totalCells = 0;
  rows.slice(0, 5).each((_: any, tr: any) => {
    $(tr).find("td").each((_: any, td: any) => {
      totalCells++;
      if ($(td).text().trim().length > 100) longCells++;
    });
  });
  if (totalCells > 0 && longCells / totalCells > 0.5) return true;
  
  return false;
}

/**
 * Find all tables that look like subsidiary tables
 */
export function findAllSubsidiaryTables($: any, tables: any): any[] {
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
 * Find the header row index in a table
 */
export function findHeaderRow($: any, rows: any): number {
  let headerRowIndex = -1;

  rows.slice(0, 10).each((i: number, tr: any) => {
    const $tr = $(tr);
    const hasThCells = $tr.find("th").length > 0;
    const text = $tr.text().toLowerCase();
    const cellCount = $tr.find("td, th").length;

    if (cellCount === 1) return;
    if (text.length < 10 && !text.includes("name")) return;

    if (hasThCells && headerRowIndex === -1) {
      headerRowIndex = i;
      return false;
    }

    if (
      headerRowIndex === -1 &&
      containsAny(text, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) &&
      containsAny(text, SUBSIDIARY_KEYWORDS.JURISDICTION)
    ) {
      headerRowIndex = i;
      return false;
    }
  });

  return headerRowIndex;
}

/**
 * Filter cells to only include those with actual content
 * Skips empty width-defining cells (common in SEC filings with colspan tables)
 *
 * A cell is considered to have content if:
 * - It has non-empty text content (after removing zero-width characters)
 * - Zero-width characters (U+200B-U+200D, U+FEFF) are not considered content
 */
export function filterContentCells($: any, cells: any): any {
  return cells.filter((_: number, td: any) => {
    const $td = $(td);
    const text = $td.text()
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, "");  // Remove zero-width chars
    return text.length > 0;
  });
}

/**
 * Extract column headers from a header row
 */
export function extractHeaders($: any, headerRow: any): string[] {
  const headers: string[] = [];
  const allCells = $(headerRow).find("th, td");
  const cells = filterContentCells($, allCells);

  cells.each((_: any, cell: any) => {
      let text = $(cell)
        .text()
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) text = `Column_${headers.length}`;
      headers.push(text);
    });

  return headers;
}

/**
 * Check if a row is a header row (not data)
 */
export function isHeaderRow(name: string, jurisdiction: string): boolean {
  const nameLower = name.toLowerCase();
  const text = (name + " " + jurisdiction).toLowerCase();
  
  // If name is just a year (e.g., "2023", "2024"), it's a sub-header row
  if (/^(19|20)\d{2}$/.test(name.trim())) return true;
  
  // If name looks like an actual company name, it's NOT a header
  const companyIndicators = ["llc", "inc.", "corp", "ltd", "l.l.c", "s.a.", "gmbh", "b.v.", "pty", "plc", "n.v."];
  if (companyIndicators.some(ind => nameLower.includes(ind))) return false;
  
  // Check for explicit header patterns
  if (text.includes("name") && text.includes("jurisdiction")) return true;
  
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
         hasOwnershipHeader;
}
