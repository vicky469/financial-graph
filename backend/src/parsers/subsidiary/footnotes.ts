/**
 * Footnote extraction and mapping utilities
 * 
 * Handles:
 * - Extracting footnotes from document (text and tables)
 * - Extracting footnote references from subsidiary names and ownership
 * - Mapping footnote references to ownership values
 */

import type { FootnoteMap } from "./types";

// ============================================================================
// Footnote Patterns
// ============================================================================

/** Matches just a footnote marker in a table cell: (1), 1., 1), *1 */
const FOOTNOTE_MARKER_PATTERN = /^[\(\*]?(\d+)[\)\.]?$/;

/** Matches footnote marker + content in paragraphs */
const FOOTNOTE_WITH_CONTENT_PATTERNS = [
  /^\s*\((\d+)\)\s*(.+)$/,  // (1) text
  /^\s*(\d+)\.\s+(.+)$/,    // 1. text
  /^\s*(\d+)\)\s+(.+)$/,    // 1) text
  /^\s*\*(\d+)\s*(.+)$/,    // *1 text
];

/** Matches footnote refs inline in text */
const FOOTNOTE_REF_PATTERNS = [
  /\((\d+)\)/g,  // (1), (2)
  /\*(\d+)/g,    // *1, *2
];

// ============================================================================
// Document-level extraction (called once per document)
// ============================================================================

/**
 * Extract footnote definitions from the document
 * Looks for footnote patterns in text and tables
 */
export function extractDocumentFootnotes($: any): FootnoteMap {
  const footnotes: FootnoteMap = {};

  // Search in paragraphs, divs, and small text elements
  $("p, div, span, font, td").each((_: any, el: any) => {
    const text = $(el).text().trim();
    
    // Skip if too long (likely not a footnote)
    if (text.length > 500) return;
    
    for (const pattern of FOOTNOTE_WITH_CONTENT_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const num = match[1];
        const content = match[2].trim();
        if (content && !footnotes[num]) {
          footnotes[num] = content;
        }
      }
    }
  });

  // Look for footnote tables (small tables at the bottom)
  $("table").each((_: any, tbl: any) => {
    const $tbl = $(tbl);
    const rows = $tbl.find("tr");
    
    // Small tables (1-10 rows) might be footnote tables
    if (rows.length > 0 && rows.length <= 10) {
      rows.each((_: any, tr: any) => {
        const cells = $(tr).find("td");
        if (cells.length >= 2) {
          const firstCell = $(cells[0]).text().trim();
          const secondCell = $(cells[1]).text().trim();
          
          const numMatch = firstCell.match(FOOTNOTE_MARKER_PATTERN);
          if (numMatch && secondCell) {
            const num = numMatch[1];
            if (!footnotes[num]) {
              footnotes[num] = secondCell;
            }
          }
        }
      });
    }
  });

  return footnotes;
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
  
  // Pattern: "100%1" or "51%2" - percentage followed by footnote number
  const match = trimmed.match(/^([\d.]+)%(\d+)$/);
  if (match) {
    const ownership = parseFloat(match[1]);
    const ref = match[2];
    if (!isNaN(ownership) && ownership >= 0 && ownership <= 100) {
      return { ownership, refs: [ref] };
    }
  }
  
  // Pattern: "100%" or "51%" - just percentage, no footnote
  const percentMatch = trimmed.match(/^([\d.]+)%$/);
  if (percentMatch) {
    const ownership = parseFloat(percentMatch[1]);
    if (!isNaN(ownership) && ownership >= 0 && ownership <= 100) {
      return { ownership, refs: [] };
    }
  }
  
  return { ownership: undefined, refs: [] };
}