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
]);

/** Keywords that identify percentage/ownership columns */
const PERCENTAGE = new Set(["percent", "%", "ownership"]);

export const SUBSIDIARY_KEYWORDS = {
  SUBSIDIARY_NAME,
  JURISDICTION,
  PERCENTAGE,

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
