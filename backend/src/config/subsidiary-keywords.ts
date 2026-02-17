/**
 * Keyword sets for parsing SEC EX-21 subsidiary filings
 *
 * This configuration defines the keywords used to identify and parse
 * subsidiary information from SEC filings (Exhibit 21).
 */

/** Keywords that identify company/subsidiary name columns */
const SUBSIDIARY_NAME = new Set([
  "name",
  "subsidiary",
  "subsidiaries",
  "entity",
  "company",
  "organization",
]);

/** Keywords that identify jurisdiction/incorporation columns */
const JURISDICTION = new Set([
  "jurisdiction",
  "state",
  "organization",
  "incorporation",
  "country",
  "location",
  "organized",
  "domicile",
  "laws", // "Laws of [State]" is common in SEC filings
]);

/** Keywords that identify percentage/ownership columns */
const PERCENTAGE = new Set(["percent", "%", "ownership"]);

/** Label-style alias text that should not be parsed as subsidiary/jurisdiction values */
const ALIAS_LABELS = new Set([
  "name under which business conducted",
  "doing business as",
  "d/b/a",
  "dba",
]);

/** Keywords that identify footnote/note tables */
const FOOTNOTE_MARKERS = new Set([
  "note",
  "excludes", 
  "exclude",
  "includes",
  "see",
  "refer",
  "footnote",
  "reference",
  "except",
  "excluding",
  "including",
  "liquidation",
  "dissolution", 
  "dormant",
  "inactive",
]);

/** Keywords that identify document headers/titles (should be excluded from subsidiary lists) */
const DOCUMENT_HEADERS = new Set([
  "exhibit",
  "subsidiaries of",
  "list of subsidiaries",
  "subsidiary companies",
  "significant subsidiaries",
  "subsidiaries list",
]);

export const SUBSIDIARY_KEYWORDS = {
  SUBSIDIARY_NAME,
  JURISDICTION,
  PERCENTAGE,
  ALIAS_LABELS,
  FOOTNOTE_MARKERS,
  DOCUMENT_HEADERS,

  /** Title/header row markers (combined from above) */
  TITLE_MARKERS: new Set([...SUBSIDIARY_NAME, ...JURISDICTION, ...PERCENTAGE]),
} as const;

/**
 * Check if text contains any keyword from a given keyword set
 */
export function containsAny(text: string, keywords: Set<string>): boolean {
  const lower = text.toLowerCase();
  return Array.from(keywords).some((keyword) => lower.includes(keyword));
}

/**
 * True when text looks like an alias metadata label row/cell, e.g.
 * "Name under which business conducted:" or "doing business as: <alias>".
 */
export function isAliasLabelText(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (!value) return false;

  // Trim a single trailing ":" so "doing business as:" matches canonical labels.
  const withoutTrailingColon = value.replace(/:\s*$/, "").trim();
  // Match common DBA prefixes, with optional leading "also ".
  if (/^(also\s+)?(d\/b\/a|dba|doing business as)\b/.test(withoutTrailingColon)) {
    return true;
  }
  if (SUBSIDIARY_KEYWORDS.ALIAS_LABELS.has(withoutTrailingColon)) {
    return true;
  }

  return value.includes(":") && containsAny(value, SUBSIDIARY_KEYWORDS.ALIAS_LABELS);
}
