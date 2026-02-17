/**
 * Footnote extraction utilities
 *
 * Handles:
 * - Extracting footnote section HTML from document
 * - Extracting footnote references from subsidiary names and ownership
 */

import {
  FOOTNOTE_REF_PATTERNS,
  PARENTHESIZED_NOTE_ROW_REGEX,
  hasNoteRowPrefix,
  normalizeNoteText,
  hasLeadingSuperscriptNoteMarker,
} from "./note-markers";

// ============================================================================
// Document-level extraction (called once per document)
// ============================================================================

/**
 * Extract footnote section HTML from the document
 *
 * Looks for tables or sections that contain footnote markers like (1), (2), etc.
 * Returns the raw HTML of the footnote section(s) for LLM processing.
 *
 * @param $ - Cheerio instance
 * @returns Raw HTML string of footnote sections, or empty string if none found
 */
export function extractDocumentFootnotes($: any): string {
  const footnoteSections: string[] = [];

  // Look for footnote rows embedded in tables and standalone footnote tables.
  $("table").each((_: any, tbl: any) => {
    const $tbl = $(tbl);
    const rows = $tbl.find("tr");
    const inlineStartRowIndex = findInlineFootnoteStartRow($, rows);

    if (inlineStartRowIndex >= 0) {
      const inlineRowsHtml = rows
        .slice(inlineStartRowIndex)
        .toArray()
        .map((row: any) => $.html(row))
        .join("\n");
      if (inlineRowsHtml.trim().length > 0) {
        footnoteSections.push(`<table>${inlineRowsHtml}</table>`);
      }
      return;
    }

    // Small tables might be dedicated footnote tables.
    if (rows.length > 0 && rows.length <= 20) {
      // Check if this table contains footnote markers
      let hasFootnoteMarkers = false;
      rows.each((_: any, tr: any) => {
        const cells = $(tr).find("td");
        if (cells.length >= 1) {
          const firstCell = normalizeNoteText($(cells[0]).text());
          // Look for patterns like "(1)", "(2)", "(1A)".
          if (hasNoteRowPrefix(firstCell)) {
            hasFootnoteMarkers = true;
            return false; // break
          }
        }
      });

      if (hasFootnoteMarkers) {
        footnoteSections.push($.html(tbl));
      }
    }
  });

  // Also look for footnote paragraphs/divs
  $("p, div").each((_: any, el: any) => {
    const text = normalizeNoteText($(el).text());
    // Look for footnote patterns: (1) text, (1A) text, etc.
    if (PARENTHESIZED_NOTE_ROW_REGEX.test(text) && text.length < 500) {
      footnoteSections.push($.html(el));
    }
  });

  return footnoteSections.join("\n\n");
}

function isInlineFootnoteRow($: any, row: any): boolean {
  const cells = $(row).find("td, th");
  if (cells.length === 0) return false;

  let nonEmptyCount = 0;
  let firstNonEmptyText = "";
  let firstNonEmptyCell: any = null;

  cells.each((_: any, cell: any) => {
    const text = normalizeNoteText($(cell).text());
    if (!text) return;
    nonEmptyCount++;
    if (!firstNonEmptyCell) {
      firstNonEmptyCell = cell;
      firstNonEmptyText = text;
    }
  });

  if (nonEmptyCount !== 1 || !firstNonEmptyCell) return false;

  if (
    hasNoteRowPrefix(firstNonEmptyText)
  ) {
    return true;
  }

  return hasLeadingSuperscriptNoteMarker($, firstNonEmptyCell);
}

function findInlineFootnoteStartRow($: any, rows: any): number {
  for (let i = 0; i < rows.length; i++) {
    if (isInlineFootnoteRow($, rows[i])) {
      return i;
    }
  }
  return -1;
}

// ============================================================================
// Row-level extraction (called per subsidiary row)
// ============================================================================

/**
 * Extract footnote refs from name column: "Company (1)(4)" → ["1", "4"]
 */
export function extractFootnoteRefFromName(text: string): string[] {
  const refs: string[] = [];

  for (const pattern of FOOTNOTE_REF_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (!refs.includes(match[1])) {
        refs.push(match[1]);
      }
    }
  }

  return refs;
}

/**
 * Parse ownership cell and extract footnote refs: "100%1" → { ownership: 100, refs: ["1"] }
 * Handles combined ownership+footnote pattern unique to ownership column
 */
export function parseOwnershipWithFootnoteRef(text: string): {
  ownership: number | undefined;
  refs: string[];
} {
  const trimmed = text.trim();

  // Pattern: "100%1" or "51%2" or "100%1A" - percentage followed by footnote ref
  const match = trimmed.match(/^([\d.]+)%(\d+[A-Za-z]?)$/);
  if (match) {
    const ownership = parseFloat(match[1]);
    const ref = match[2];
    if (!isNaN(ownership) && ownership >= 0 && ownership <= 100) {
      return { ownership, refs: [ref] };
    }
  }

  // Pattern: "100%" or "51%" - just percentage, no footnote
  const percentMatch = trimmed.match(/^([\d.]+)%?$/);
  if (percentMatch) {
    const ownership = parseFloat(percentMatch[1]);
    if (!isNaN(ownership) && ownership >= 0 && ownership <= 100) {
      return { ownership, refs: [] };
    }
  }

  return { ownership: undefined, refs: [] };
}
