/**
 * Cell parsing utilities
 *
 * Each cell type has a dedicated parser that extracts all relevant data in one pass.
 */

import {
  extractFootnoteRefFromName,
  parseOwnershipWithFootnoteRef,
} from "../footnote/footnotes";

const PARENTHETICAL_CONTENT_REGEX = /\(([^)]*)\)/g;
const HAS_DIGIT_REGEX = /\d/;
const PERCENTAGE_VALUE_REGEX = /^\d+(?:\.\d+)?\s*%$/;
const HAS_LETTER_REGEX = /[A-Za-z]/;
const MIN_JURISDICTION_TOKEN_LENGTH = 2;
const MAX_JURISDICTION_TOKEN_LENGTH = 80;

// ============================================================================
// Types
// ============================================================================

export interface ParsedNameCell {
  rawName: string;
  cleanName: string;
  footnoteRefs: string[];
  ownershipFromName?: number; // Ownership percentage extracted from name like "(32.5%)"
  jurisdictionFromName?: string; // Jurisdiction extracted from parenthetical text like "(Ohio)"
}

export interface ParsedOwnershipCell {
  ownership: number | undefined;
  footnoteRefs: string[];
}

export interface ParsedJurisdictionCell {
  jurisdiction_raw: string;
}

// ============================================================================
// Cell Parsers
// ============================================================================

/**
 * Parse name cell: extract clean name, footnote refs, and ownership if embedded
 */
export function parseNameCell(text: string): ParsedNameCell {
  const rawName = text.trim();
  const footnoteRefs = extractFootnoteRefFromName(rawName);

  // Extract ownership percentage from name like "Company Name (32.5%)" or "(100%)"
  // Match patterns: (32.5%), (100%), (99.75%)
  const ownershipMatch = rawName.match(/\((\d+(?:\.\d+)?)\s*%\)/);
  const ownershipFromName = ownershipMatch
    ? parseFloat(ownershipMatch[1])
    : undefined;
  const jurisdictionFromName = extractJurisdictionFromParenthetical(rawName);

  const cleanName = cleanSubsidiaryName(rawName);

  return {
    rawName,
    cleanName,
    footnoteRefs,
    ownershipFromName,
    jurisdictionFromName,
  };
}

/**
 * Parse ownership cell: extract percentage and footnote refs
 * Handles patterns like "100%", "100%1", "51"
 */
export function parseOwnershipCell(text: string): ParsedOwnershipCell {
  const trimmed = text.trim();

  // Try "100%1" pattern first (ownership + footnote)
  const withRef = parseOwnershipWithFootnoteRef(trimmed);
  if (withRef.ownership !== undefined) {
    return { ownership: withRef.ownership, footnoteRefs: withRef.refs };
  }

  // Fallback: Check for just footnote refs (e.g. "Note (1)")
  // This allows mapping ownership cells that just point to a note
  const refs = extractFootnoteRefFromName(trimmed);
  if (refs.length > 0) {
    return { ownership: undefined, footnoteRefs: refs };
  }

  return { ownership: undefined, footnoteRefs: [] };
}

/**
 * Parse jurisdiction cell: extract jurisdiction
 */
export function parseJurisdictionCell(text: string): ParsedJurisdictionCell {
  const trimmed = text.trim();

  // Remove percentages if present (shouldn't be here, but clean up)
  let jurisdiction_raw = trimmed
    .replace(/\d+(\.\d+)?\s*%/g, "")
    .replace(/\s+/g, " ")
    .trim();

  jurisdiction_raw = stripLeadingSymbols(jurisdiction_raw);
  if (jurisdiction_raw === "%") {
    jurisdiction_raw = "";
  }

  // If what's left is just a number, clear it
  // This likely means an ownership value shifted into jurisdiction column
  if (/^[\d.]+$/.test(jurisdiction_raw)) {
    jurisdiction_raw = "";
  }

  return { jurisdiction_raw };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Clean subsidiary name by removing footnotes and formatting
 */
function cleanSubsidiaryName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "") // Remove parenthetical content (footnotes)
    .replace(/\*\d+/g, "") // Remove *1, *2 style refs
    .replace(/[—\-]+\s*/g, "") // Remove bullets and dashes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

function stripLeadingSymbols(value: string): string {
  return value.replace(/^[\s\-–—•●▪■·\u2022\u25cf\u25aa\u25a0]+/g, "").trim();
}

function extractJurisdictionFromParenthetical(name: string): string | undefined {
  // Capture each "(...)" group from the name and test candidates in order.
  const matches = Array.from(name.matchAll(PARENTHETICAL_CONTENT_REGEX));
  for (const match of matches) {
    const candidate = normalizeParentheticalCandidate(match[1] || "");
    if (!isValidParentheticalJurisdictionCandidate(candidate)) continue;
    return candidate;
  }
  return undefined;
}

function normalizeParentheticalCandidate(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isValidParentheticalJurisdictionCandidate(candidate: string): boolean {
  if (!candidate) return false;
  // Reject anything containing digits.
  if (HAS_DIGIT_REGEX.test(candidate)) return false;
  // Reject pure percentage values like "100%" or "32.5 %".
  if (PERCENTAGE_VALUE_REGEX.test(candidate)) return false;
  if (
    candidate.length < MIN_JURISDICTION_TOKEN_LENGTH ||
    candidate.length > MAX_JURISDICTION_TOKEN_LENGTH
  ) {
    return false;
  }
  // Candidate must contain at least one letter.
  return HAS_LETTER_REGEX.test(candidate);
}
