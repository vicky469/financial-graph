/**
 * Keyword sets for parsing SEC EX-21 subsidiary filings
 *
 * This configuration defines the keywords used to identify and parse
 * subsidiary information from SEC filings (Exhibit 21).
 */

export const SUBSIDIARY_KEYWORDS = {
  /**
   * Keywords that identify company/subsidiary name columns
   * Examples: "Name", "Subsidiary Name", "Entity", "Company"
   */
  SUBSIDIARY_NAME: new Set([
    "name",
    "subsidiary",
    "subsidiaries",
    "entity",
    "company",
  ]),

  /**
   * Keywords that identify jurisdiction/incorporation columns
   * Examples: "Jurisdiction", "State of Incorporation", "Country"
   */
  JURISDICTION: new Set([
    "jurisdiction",
    "state",
    "organization",
    "incorporation",
    "country",
    "location",
    "organized",
  ]),

  /**
   * Keywords that identify percentage/ownership columns (to be skipped)
   * Examples: "Ownership %", "Percent Owned"
   */
  PERCENTAGE: new Set(["percent", "%", "ownership"]),

  /**
   * Keywords that identify Exhibit 21 markers in document
   * Used for scoring tables to find the subsidiary list
   */
  EXHIBIT_MARKER: new Set(["exhibit 21"]),

  /**
   * Keywords that identify title rows (to be skipped)
   * These are document titles, not data rows
   */
  TITLE_MARKERS: new Set([
    "subsidiaries of",
    "subsidiary of",
    "the following",
    "list of",
    "registrant",
    "consolidated subsidiaries",
    "name of",
  ]),

  /**
   * Keywords that identify section headers (to be skipped)
   * These divide the table into sections but are not data
   */
  SECTION_HEADERS: new Set([
    "domestic subsidiaries",
    "foreign subsidiaries",
    "international subsidiaries",
    "section",
  ]),
} as const;

/**
 * Check if text contains any keyword from a given keyword set
 *
 * @param text - The text to search (case-insensitive)
 * @param keywords - Set of keywords to search for
 * @returns true if any keyword is found in the text
 *
 * @example
 * ```typescript
 * containsAny("Company Name", SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) // true
 * containsAny("Revenue", SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) // false
 * ```
 */
export function containsAny(text: string, keywords: Set<string>): boolean {
  const lower = text.toLowerCase();
  return Array.from(keywords).some((keyword) => lower.includes(keyword));
}
