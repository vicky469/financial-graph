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
 * Check if a table contains subsidiary data even without explicit headers
 * This handles cases where tables go straight to data without header rows
 */
export function hasSubsidiaryData($: any, table: any): boolean {
  const rows = table.find("tr");
  if (rows.length < 2) return false;
  
  let subsidiaryDataRows = 0;
  let totalContentRows = 0;
  let companyNameRows = 0;
  let jurisdictionRows = 0;
  
  // Check first 10 rows for subsidiary-like patterns
  rows.slice(0, 10).each((_: any, row: any) => {
    const $row = $(row);
    const cells = $row.find("td, th");
    const cellTexts = cells.map((_: any, cell: any) => $(cell).text().trim()).get();
    
    // Skip empty rows
    if (cellTexts.every(text => text.length === 0)) return;
    
    // Skip rows that are clearly descriptive text (long single-cell content)
    if (cells.length === 1 && cellTexts[0].length > 100) return;
    
    totalContentRows++;
    
    // Look for patterns that suggest subsidiary data:
    // 1. Company name patterns (contains LLC, Inc, Corp, Ltd, etc.)
    // 2. Jurisdiction patterns (country/state names)
    // 3. At least 2 non-empty cells (name + jurisdiction pattern)
    
    const hasCompanyName = cellTexts.some((text: string) => {
      const lower = text.toLowerCase();
      return lower.includes('llc') || lower.includes('inc') || lower.includes('corp') || 
             lower.includes('ltd') || lower.includes('limited') || lower.includes('company') ||
             lower.includes('s.a.') || lower.includes('gmbh') || lower.includes('b.v.') ||
             lower.includes('pty') || lower.includes('plc') || lower.includes('n.v.') ||
             lower.includes('bank') || lower.includes('corporation') || lower.includes('national');
    });
    
    const hasJurisdiction = cellTexts.some((text: string) => {
      const lower = text.toLowerCase();
      // Common countries and states - expanded list
      return lower.includes('united states') || lower.includes('delaware') || 
             lower.includes('new york') || lower.includes('california') || 
             lower.includes('colombia') || lower.includes('india') || 
             lower.includes('chile') || lower.includes('netherlands') ||
             lower.includes('canada') || lower.includes('uk') || lower.includes('germany') ||
             lower.includes('france') || lower.includes('japan') || lower.includes('australia') ||
             lower.includes('west virginia') || lower.includes('virginia') || lower.includes('texas') ||
             lower.includes('florida') || lower.includes('nevada') || lower.includes('illinois') ||
             lower.includes('pennsylvania') || lower.includes('ohio') || lower.includes('michigan') ||
             lower.includes('georgia') || lower.includes('north carolina') || lower.includes('south carolina');
    });
    
    const hasMultipleCells = cellTexts.filter((text: string) => text.length > 0).length >= 2;
    
    // Track company names and jurisdictions separately for multi-row detection
    if (hasCompanyName) companyNameRows++;
    if (hasJurisdiction) jurisdictionRows++;
    
    // Single-row pattern: require both company name AND jurisdiction patterns
    if (hasCompanyName && hasJurisdiction && hasMultipleCells) {
      subsidiaryDataRows++;
    }
    // Multi-row pattern: company name OR jurisdiction (but not both in same row)
    else if ((hasCompanyName || hasJurisdiction) && hasMultipleCells) {
      subsidiaryDataRows++;
    }
  });
  
  // For single-row pattern: require at least 3 complete subsidiary rows
  if (subsidiaryDataRows >= 3 && totalContentRows > 0 && (subsidiaryDataRows / totalContentRows) >= 0.3) {
    return true;
  }
  
  // For multi-row pattern: require both company names AND jurisdictions present
  // This handles cases like City National Bank where data spans multiple rows
  if (companyNameRows >= 2 && jurisdictionRows >= 2 && totalContentRows >= 4) {
    return true;
  }
  
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
 * Find the header row index in a table - check first 6 rows to handle cases with descriptive text
 */
export function findHeaderRow($: any, rows: any): number {
  // Check first 6 rows for the best header match (increased from 3 to handle descriptive text)
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const $tr = $(rows[i]);
    const text = $tr.text().toLowerCase();
    
    // Skip empty rows
    if (text.trim().length < 3) continue;
    
    // Skip rows that are clearly descriptive text (long single-cell content)
    const cells = $tr.find('td, th');
    if (cells.length === 1 && text.length > 100) continue;
    
    // If row has both name and jurisdiction keywords AND has multiple cells, it's likely a header
    if (containsAny(text, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) && 
        containsAny(text, SUBSIDIARY_KEYWORDS.JURISDICTION) &&
        cells.length >= 2) {
      return i;
    }
  }
  
  // Fallback: check for TH elements in first 6 rows
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const $tr = $(rows[i]);
    if ($tr.find("th").length > 0) {
      return i;
    }
  }
  
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
