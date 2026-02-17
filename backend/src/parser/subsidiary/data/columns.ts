/**
 * Column parsing utilities
 *
 * Parses all columns based on pre-detected indices.
 */

import type { ParsedColumns } from "../parser-types";
import {
  isAliasLabelText,
} from "../../../config/subsidiary-keywords";
import {
  parseNameCell,
  parseOwnershipCell,
  parseJurisdictionCell,
} from "./cells";
import { analyzeIndentation } from "./nesting";
import {
  hasCompanyEntitySuffix,
  isLayoutOnlyCell,
} from "../shape/table-detection";

// Percent/empty noise tokens commonly found in ownership columns (e.g., "100", "100%", "%", "-", em dash).
const IS_PERCENTAGE_OR_EMPTY = /^\d+(?:\.\d+)?\s*%?$|^%$|^-+$|^—$/;
// Ownership-like numeric value with optional decimal and optional trailing percent.
const IS_OWNERSHIP_LIKE = /^\d+(?:\.\d+)?\s*%?$/;
// Free-form jurisdiction-like text: starts with letter, mostly text punctuation, bounded length.
const IS_JURISDICTION_LIKE = /^[A-Za-z][A-Za-z\s\.\-&',]{1,80}$/;
// Strict legal-entity token matcher used for shift-guard decisions.
const STRICT_COMPANY_ENTITY_TOKEN_REGEX =
  /\b(?:inc(?:orporated)?|corp(?:oration)?|co|company|llc|llp|lp|ltd|limited|plc|pllc|pc|gmbh|kg|kgaa|ug|bv|nv|sa|sarl|spa|srl|ab|oy|oyj|as|asa|aps|pte|pty|sdn bhd|co ltd)\b/i;

/**
 * Check if a cell contains a Roman numeral level indicator (I, II, III, IV, V, VI, VII, VIII)
 * These are used in some SEC filings to indicate nesting level
 */
function isRomanNumeralLevel(text: string): boolean {
  const trimmed = text.trim();
  // Match Roman numerals I through VIII (common nesting levels)
  return /^(I{1,3}|IV|VI{0,3}|I?X)$/i.test(trimmed);
}

function isNumericLevelMarker(text: string): boolean {
  // Numeric row prefix markers like "1", "1.", "2)" used as indentation/outline markers.
  return /^\d{1,3}[.)]?$/.test(text.trim());
}

function looksLikeCompanyText(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  const normalized = value
    .toLowerCase()
    // Drop dots and apostrophes so legal forms normalize consistently ("B.V." -> "bv", "Lloyd's" -> "lloyds").
    .replace(/[.\u2019']/g, "")
    // Treat grouping punctuation as token separators.
    .replace(/[(),]/g, " ")
    // Collapse repeated whitespace to single spaces for stable token matching.
    .replace(/\s+/g, " ")
    .trim();
  return STRICT_COMPANY_ENTITY_TOKEN_REGEX.test(normalized);
}

function looksLikeCompanyTextBroad(text: string): boolean {
  const value = text.trim();
  return value.length > 0 && hasCompanyEntitySuffix(value);
}

function looksLikeOwnershipText(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return IS_PERCENTAGE_OR_EMPTY.test(value) || IS_OWNERSHIP_LIKE.test(value);
}

function isAliasLabelValue(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return isAliasLabelText(value);
}

function looksLikeJurisdictionText(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  // Common 2-letter jurisdiction abbreviations (e.g., "NV", "DE", "OH").
  if (/^[A-Z]{2}$/.test(value)) return true;
  if (isAliasLabelValue(value)) return false;
  if (looksLikeOwnershipText(value)) return false;
  if (looksLikeCompanyText(value)) return false;
  if (!IS_JURISDICTION_LIKE.test(value)) return false;

  const letters = (value.match(/[A-Za-z]/g) || []).length;
  return letters >= Math.max(2, Math.ceil(value.length * 0.55));
}

/**
 * Detect if data row has an offset (Roman numeral or empty indentation)
 * Returns the offset to add to column indices (0 or 1)
 */
function detectRowOffset(
  $: any,
  cells: any,
  cellCount: number,
  nameColIdx: number
): number {
  // Only apply if name column is expected to be the first one
  if (cellCount >= 2 && nameColIdx === 0) {
    const firstCellText = $(cells[0]).text().trim();
    const secondCellText = $(cells[1]).text().trim();

    // Check for Roman Numeral in first col
    if (
      (isRomanNumeralLevel(firstCellText) || isNumericLevelMarker(firstCellText)) &&
      secondCellText.length > 3
    ) {
      return 1;
    }

    // Check for Empty First Col (Indentation)
    // Avoid shifting if second cell is empty too
    if (!firstCellText && secondCellText.length > 1) {
      return 1;
    }
  }
  return 0;
}

function findRawCellIndexForFilteredIndex(
  $: any,
  rawCells: any,
  filteredIndex: number,
): number {
  if (!rawCells || filteredIndex < 0) return -1;

  let contentIndex = 0;
  for (let rawIndex = 0; rawIndex < rawCells.length; rawIndex++) {
    if (isLayoutOnlyCell($, rawCells[rawIndex])) continue;
    if (contentIndex === filteredIndex) {
      return rawIndex;
    }
    contentIndex++;
  }

  return -1;
}

function countLeadingLayoutCellsBefore(
  $: any,
  rawCells: any,
  rawIndex: number,
): number {
  if (!rawCells || rawIndex <= 0) return 0;

  let count = 0;
  for (let i = rawIndex - 1; i >= 0; i--) {
    if (!isLayoutOnlyCell($, rawCells[i])) {
      break;
    }
    count++;
  }

  return count;
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
  ownershipColIdx: number,
  rawCells?: any,
): ParsedColumns {
  // Detect if data row has an offset (Roman numeral or empty indentation)
  const offset = detectRowOffset($, cells, cellCount, nameColIdx);

  // Adjust indices for offset
  const adjustedNameColIdx = nameColIdx + offset;
  let adjustedJurColIdx = jurColIdx + offset;
  const adjustedOwnershipColIdx =
    ownershipColIdx !== -1 ? ownershipColIdx + offset : -1;

  // Parse name
  const nameCell = $(cells[adjustedNameColIdx]);
  const nameParsed = parseNameCell(nameCell.text());
  let indentInfo = analyzeIndentation(nameCell, nameParsed.rawName);

  // If indentation is encoded in leading empty spacer columns,
  // preserve it from the raw row even though semantic parsing uses filtered cells.
  if (!indentInfo.hasIndentation && rawCells) {
    const rawNameColIdx = findRawCellIndexForFilteredIndex(
      $,
      rawCells,
      adjustedNameColIdx,
    );
    const leadingLayoutCells = countLeadingLayoutCellsBefore(
      $,
      rawCells,
      rawNameColIdx,
    );
    if (leadingLayoutCells > 0) {
      indentInfo = { spaces: leadingLayoutCells, hasIndentation: true };
    }
  }

  // Adjust jurisdiction index if data has more columns than headers indicated
  // This handles multi-row headers where merged cells don't match data column count
  // E.g., header has "Ownership" spanning 2 columns (2023, 2024), but jurColIdx was calculated from header count

  // If jurisdiction index is out of bounds or points to a percentage/empty value,
  // try to find the actual jurisdiction column by scanning from the end
  let needsJurisdictionFallback = false;
  let jurText = "";

  if (adjustedJurColIdx >= 0 && adjustedJurColIdx < cellCount) {
    jurText = $(cells[adjustedJurColIdx]).text().trim();
    // Check if the "jurisdiction" cell looks like a percentage or is empty
    needsJurisdictionFallback =
      IS_PERCENTAGE_OR_EMPTY.test(jurText) ||
      jurText === "" ||
      (adjustedJurColIdx === adjustedNameColIdx && cellCount > adjustedNameColIdx + 1);
  } else {
    // Jurisdiction index is out of bounds (e.g., header has 3 cols but data row only has 2)
    needsJurisdictionFallback = true;
  }

  if (needsJurisdictionFallback) {
    // Scan backwards from the end to find a non-percentage, non-empty cell
    for (let i = cellCount - 1; i > adjustedNameColIdx; i--) {
      const cellText = $(cells[i]).text().trim();
      // Skip percentage values, dashes, and common non-jurisdiction values
      if (
        cellText &&
        !isAliasLabelValue(cellText) &&
        !looksLikeOwnershipText(cellText) &&
        !looksLikeCompanyTextBroad(cellText)
      ) {
        adjustedJurColIdx = i;
        break;
      }
    }
  }

  // Parse jurisdiction
  const jurResult = parseJurisdictionCell($(cells[adjustedJurColIdx]).text());
  let cleanName = nameParsed.cleanName;
  let jurisdictionRaw = jurResult.jurisdiction_raw;

  if (isAliasLabelValue(jurisdictionRaw)) {
    jurisdictionRaw = "";
  }

  // Guard against shifted rows where a company name lands in jurisdiction column.
  if (
    jurisdictionRaw &&
    looksLikeCompanyText(jurisdictionRaw) &&
    !looksLikeJurisdictionText(jurisdictionRaw)
  ) {
    if (!looksLikeCompanyText(cleanName)) {
      // Likely left-shift: move company-like value into name and keep only jurisdiction-like text.
      cleanName = jurisdictionRaw;
      jurisdictionRaw = looksLikeJurisdictionText(nameParsed.rawName)
        ? nameParsed.rawName.trim()
        : "";
    } else {
      // Both look company-like; keep detected name and drop suspicious jurisdiction.
      jurisdictionRaw = "";
    }
  }

  if (
    !jurisdictionRaw &&
    adjustedJurColIdx === adjustedNameColIdx &&
    nameParsed.jurisdictionFromName
  ) {
    jurisdictionRaw = nameParsed.jurisdictionFromName;
  }

  // Parse ownership - handle multi-year columns (e.g., 2023, 2024)
  // When header has merged "Percentage Ownership" spanning multiple year columns,
  // pick the most recent year's value
  let ownership: number | undefined;
  let ownershipFootnoteRefs: string[] = [];
  if (adjustedOwnershipColIdx !== -1 && adjustedOwnershipColIdx < cellCount) {
    // Check if there are consecutive percentage columns (multi-year ownership)
    // Look for year-like columns after adjustedOwnershipColIdx
    const finalOwnershipColIdx = findMostRecentOwnershipColumn(
      $,
      cells,
      cellCount,
      adjustedOwnershipColIdx,
      adjustedJurColIdx
    );

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
    cleanName,
    nameFootnoteRefs: nameParsed.footnoteRefs,
    indentationSpaces: indentInfo.spaces,
    jurisdiction: jurisdictionRaw,
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
