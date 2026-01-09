/**
 * Column parsing utilities
 * 
 * Parses all columns based on pre-detected indices.
 */

import type { ParsedColumns } from "./types";
import { parseNameCell, parseOwnershipCell, parseJurisdictionCell } from "./cells";
import { analyzeIndentation } from "./nesting";

/**
 * Check if a cell contains a Roman numeral level indicator (I, II, III, IV, V, VI, VII, VIII)
 * These are used in some SEC filings to indicate nesting level
 */
function isRomanNumeralLevel(text: string): boolean {
  const trimmed = text.trim();
  // Match Roman numerals I through VIII (common nesting levels)
  return /^(I{1,3}|IV|VI{0,3}|I?X)$/i.test(trimmed);
}

/**
 * Detect if data row has a Roman numeral level column that headers don't have
 * Returns the offset to add to column indices (0 or 1)
 */
function detectRomanNumeralOffset($: any, cells: any, cellCount: number, nameColIdx: number): number {
  // If first cell is a Roman numeral and second cell looks like a company name, offset by 1
  if (cellCount >= 3 && nameColIdx === 0) {
    const firstCellText = $(cells[0]).text().trim();
    const secondCellText = $(cells[1]).text().trim();
    
    if (isRomanNumeralLevel(firstCellText) && secondCellText.length > 3) {
      // First cell is Roman numeral, second cell is likely the actual name
      return 1;
    }
  }
  return 0;
}

/**
 * Parse all columns based on detected indices
 * 
 * @param nameColIdx - Name column index (required, defaults to 0)
 * @param jurColIdx - Jurisdiction column index (from headers)
 * @param ownershipColIdx - Ownership column index (-1 if not found)
 */
export function parseColumns(
  $: any,
  cells: any,
  cellCount: number,
  nameColIdx: number,
  jurColIdx: number,
  ownershipColIdx: number
): ParsedColumns {
  // Detect if data row has a Roman numeral level column that shifts all indices
  // E.g., headers: [Name, Ownership, Jurisdiction] but data: [II, Name, Ownership, Jurisdiction]
  const romanOffset = detectRomanNumeralOffset($, cells, cellCount, nameColIdx);
  
  // Adjust indices for Roman numeral offset
  const adjustedNameColIdx = nameColIdx + romanOffset;
  let adjustedJurColIdx = jurColIdx + romanOffset;
  const adjustedOwnershipColIdx = ownershipColIdx !== -1 ? ownershipColIdx + romanOffset : -1;
  
  // Parse name
  const nameCell = $(cells[adjustedNameColIdx]);
  const nameParsed = parseNameCell(nameCell.text());
  const indentInfo = analyzeIndentation(nameCell, nameParsed.rawName);

  // Adjust jurisdiction index if data has more columns than headers indicated
  // This handles multi-row headers where merged cells don't match data column count
  // E.g., header has "Ownership" spanning 2 columns (2023, 2024), but jurColIdx was calculated from header count

  // If jurisdiction index is out of bounds or points to a percentage/empty value,
  // try to find the actual jurisdiction column by scanning from the end
  let needsJurisdictionFallback = false;
  let jurText = '';

  if (adjustedJurColIdx >= 0 && adjustedJurColIdx < cellCount) {
    jurText = $(cells[adjustedJurColIdx]).text().trim();
    // Check if the "jurisdiction" cell looks like a percentage or is empty
    needsJurisdictionFallback = /^\d+%?$|^-+$|^—$/.test(jurText) || jurText === '';
  } else {
    // Jurisdiction index is out of bounds (e.g., header has 3 cols but data row only has 2)
    needsJurisdictionFallback = true;
  }

  if (needsJurisdictionFallback) {
    // Scan backwards from the end to find a non-percentage, non-empty cell
    for (let i = cellCount - 1; i > adjustedNameColIdx; i--) {
      const cellText = $(cells[i]).text().trim();
      // Skip percentage values, dashes, and common non-jurisdiction values
      if (cellText && !/^\d+%?$|^-+$|^—$/.test(cellText) &&
          !/(company|holding|vessel|service|investment)/i.test(cellText)) {
        adjustedJurColIdx = i;
        break;
      }
    }
  }

  // Parse jurisdiction
  const jurResult = parseJurisdictionCell($(cells[adjustedJurColIdx]).text());

  // Parse ownership - handle multi-year columns (e.g., 2023, 2024)
  // When header has merged "Percentage Ownership" spanning multiple year columns,
  // pick the most recent year's value
  let ownership: number | undefined;
  let ownershipFootnoteRefs: string[] = [];
  if (adjustedOwnershipColIdx !== -1 && adjustedOwnershipColIdx < cellCount) {
    // Check if there are consecutive percentage columns (multi-year ownership)
    // Look for year-like columns after adjustedOwnershipColIdx
    const finalOwnershipColIdx = findMostRecentOwnershipColumn($, cells, cellCount, adjustedOwnershipColIdx, adjustedJurColIdx);
    
    const result = parseOwnershipCell($(cells[finalOwnershipColIdx]).text());
    ownership = result.ownership;
    ownershipFootnoteRefs = result.footnoteRefs;
  }
  
  // If no ownership from column, use ownership extracted from name like "(32.5%)"
  if (ownership === undefined && nameParsed.ownershipFromName !== undefined) {
    ownership = nameParsed.ownershipFromName;
  }

  return {
    rawName: nameParsed.rawName,
    cleanName: nameParsed.cleanName,
    nameFootnoteRefs: nameParsed.footnoteRefs,
    indentationSpaces: indentInfo.spaces,
    jurisdiction: jurResult.jurisdiction,
    ownership,
    ownershipFootnoteRefs,
  };
}

/**
 * Find the most recent year's ownership column when there are multi-year columns
 * E.g., if header "Percentage Ownership" spans columns for 2023 and 2024, return the 2024 column index
 */
function findMostRecentOwnershipColumn(
  $: any,
  cells: any,
  cellCount: number,
  ownershipColIdx: number,
  jurColIdx: number
): number {
  // Look for consecutive percentage-like values starting from ownershipColIdx
  // Stop before jurisdiction column
  const maxIdx = jurColIdx > ownershipColIdx ? jurColIdx : cellCount;
  
  let lastPercentageIdx = ownershipColIdx;
  
  for (let i = ownershipColIdx; i < maxIdx; i++) {
    const cellText = $(cells[i]).text().trim();
    // Check if this looks like a percentage value (number with optional %, or dash for N/A)
    if (/^\d+(?:\.\d+)?%?$|^-+$|^—$|^$/.test(cellText)) {
      lastPercentageIdx = i;
    } else {
      // Stop when we hit a non-percentage value
      break;
    }
  }
  
  return lastPercentageIdx;
}
